import express from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { requireAuth, requireRole } from "../middleware/auth.js";


const router = express.Router();

const buildTrackingEntry = (status, message) => ({
  status,
  message,
  createdAt: new Date(),
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    const productIds = items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).populate("seller", "name storeName");

    const orderItems = items.map(item => {
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

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = 0;
    const total = subtotal + shipping;

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal,
      shipping,
      total,
      status: "payment_pending",
      tracking: [buildTrackingEntry("payment_pending", "Awaiting payment confirmation")],
    });

    return res.status(201).json({ order: order.toJSON() });
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Order failed" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const isSeller = req.user.role === "seller";
  const query = isSeller
    ? { "items.seller": req.user.id, status: { $ne: "payment_pending" } }
    : { user: req.user.id };

  const orders = await Order.find(query).sort({ createdAt: -1 });
  const result = orders.map(order => {
    const json = order.toJSON();
    if (isSeller) {
      json.items = json.items.filter(item => item.seller?.toString?.() === req.user.id || item.seller === req.user.id);
    }
    return json;
  });
  return res.json({ orders: result });
});

router.put("/:id/status", requireAuth, requireRole("seller"), async (req, res) => {
  const { status } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const ownsOrder = order.items.some(item => item.seller.toString() === req.user.id);
  if (!ownsOrder) {
    return res.status(403).json({ message: "You do not own this order" });
  }

  if (!status || !["packed", "shipped", "delivered", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  if (order.status === "payment_pending") {
    return res.status(400).json({ message: "Payment not confirmed yet" });
  }

  order.status = status;
  order.tracking.push(buildTrackingEntry(status, `Order marked as ${status}`));
  await order.save();
  return res.json({ order: order.toJSON() });
});

export default router;
