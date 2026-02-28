import "../config/env.js";
import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js";
import Commission from "../models/Commission.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const keyId = process.env.RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

const razorpay = keyId && keySecret
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

const buildTrackingEntry = (status, message) => ({
  status,
  message,
  createdAt: new Date(),
});

// Helper to get week boundaries (Monday to Sunday)
const getWeekBoundaries = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
};

const buildOrderItems = async items => {
  const productIds = items.map(item => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).populate("seller", "name storeName");

  return items.map(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) {
      throw new Error("Invalid product in order");
    }

    return {
      product: product.id,
      seller: product.seller._id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
    };
  });
};

router.post("/razorpay/order", requireAuth, async (req, res) => {
  if (!razorpay) {
    console.error("Razorpay not configured. Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.");
    return res.status(500).json({ message: "Razorpay is not configured" });
  }

  try {
    const { items, couponCode } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    const orderItems = await buildOrderItems(items);
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = 0;
    const preDiscountTotal = subtotal + shipping;
    let total = preDiscountTotal;
    let couponDiscount = 0;

    // Validate and apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (!coupon) {
        return res.status(400).json({ message: "Invalid or inactive coupon code" });
      }
      couponDiscount = Math.round((preDiscountTotal * coupon.commissionRate) / 100);
      total = Math.max(preDiscountTotal - couponDiscount, 0);
    }

    const user = await User.findById(req.user.id);
    const shippingAddress = user
      ? {
          name: user.name,
          phone: user.phone,
          line1: user.address?.line1,
          line2: user.address?.line2,
          city: user.address?.city,
          state: user.address?.state,
          postalCode: user.address?.postalCode,
          country: user.address?.country || "India",
        }
      : undefined;

    const razorpayOrder = await razorpay.orders.create({
      amount: total * 100,
      currency: "INR",
      payment_capture: 1,
      notes: {
        userId: req.user.id,
        couponCode: couponCode || "",
      },
    });

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal,
      shipping,
      total,
      couponCode: couponCode ? couponCode.toUpperCase() : null,
      couponDiscount,
      status: "payment_pending",
      tracking: [buildTrackingEntry("payment_pending", "Awaiting payment confirmation")],
      shippingAddress,
      payment: {
        provider: "razorpay",
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        status: "created",
      },
    });

    return res.status(201).json({
      order: order.toJSON(),
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      keyId,
    });
  } catch (error) {
    console.error("Failed to create Razorpay order", error);
    return res.status(400).json({ message: error instanceof Error ? error.message : "Payment order failed" });
  }
});

router.post("/razorpay/verify", requireAuth, async (req, res) => {
  if (!razorpay) {
    console.error("Razorpay not configured. Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.");
    return res.status(500).json({ message: "Razorpay is not configured" });
  }

  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== req.user.id) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.payment.status === "paid") {
      return res.json({ order: order.toJSON() });
    }

    if (order.payment.orderId && order.payment.orderId !== razorpayOrderId) {
      order.payment.status = "failed";
      order.status = "cancelled";
      order.tracking.push(buildTrackingEntry("cancelled", "Payment order mismatch"));
      await order.save();
      return res.status(400).json({ message: "Payment order mismatch" });
    }

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
    if (expected !== razorpaySignature) {
      order.payment.status = "failed";
      order.status = "cancelled";
      order.tracking.push(buildTrackingEntry("cancelled", "Payment verification failed"));
      await order.save();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Create commission after successful signature verification
    if (order.couponCode) {
      const coupon = await Coupon.findOne({ code: order.couponCode, isActive: true });
      if (coupon) {
        coupon.usageCount += 1;
        await coupon.save();

        const { weekStart, weekEnd } = getWeekBoundaries();
        const commissionAmount = Math.round((order.total * coupon.commissionRate) / 100);

        await Commission.create({
          marketer: coupon.marketer,
          order: order._id,
          couponCode: order.couponCode,
          orderAmount: order.total,
          commissionRate: coupon.commissionRate,
          commissionAmount,
          weekStart,
          weekEnd,
          isPaid: false,
        });
      }
    }

    order.payment.paymentId = razorpayPaymentId;
    order.payment.signature = razorpaySignature;
    order.payment.status = "paid";
    order.status = "confirmed";
    order.tracking.push(buildTrackingEntry("confirmed", "Payment confirmed"));
    await order.save();

    return res.json({ order: order.toJSON() });
  } catch (error) {
    console.error("Failed to verify Razorpay payment", error);
    return res.status(500).json({ message: "Payment verification failed" });
  }
});

export default router;
