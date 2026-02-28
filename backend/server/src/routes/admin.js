import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Coupon from "../models/Coupon.js";
import Commission from "../models/Commission.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/sellers", requireAuth, requireRole("admin"), async (_req, res) => {
  const sellers = await User.find({ role: "seller" }).sort({ createdAt: -1 });
  return res.json({ sellers: sellers.map(user => user.toJSON()) });
});

router.get("/sellers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const seller = await User.findById(req.params.id);
  if (!seller || seller.role !== "seller") {
    return res.status(404).json({ message: "Seller not found" });
  }

  return res.json({ seller: seller.toJSON() });
});

router.get("/sellers/:id/orders", requireAuth, requireRole("admin"), async (req, res) => {
  const seller = await User.findById(req.params.id);
  if (!seller || seller.role !== "seller") {
    return res.status(404).json({ message: "Seller not found" });
  }

  const orders = await Order.find({ "items.seller": seller.id }).sort({ createdAt: -1 });
  const result = orders.map(order => {
    const json = order.toJSON();
    json.items = json.items.filter(item => item.seller?.toString?.() === seller.id || item.seller === seller.id);
    return json;
  });

  return res.json({ orders: result });
});

router.post("/sellers", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, email, password, storeName, phone, address } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const seller = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: "seller",
    storeName,
    phone,
    address,
  });

  return res.status(201).json({ seller: seller.toJSON() });
});

router.delete("/sellers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const seller = await User.findById(req.params.id);
  if (!seller || seller.role !== "seller") {
    return res.status(404).json({ message: "Seller not found" });
  }

  await Product.deleteMany({ seller: seller.id });
  await seller.deleteOne();
  return res.json({ success: true });
});

router.patch("/products/:id/feature", requireAuth, requireRole("admin"), async (req, res) => {
  const { isFeatured } = req.body || {};
  const product = await Product.findById(req.params.id).populate("seller", "name storeName");
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  product.isFeatured = Boolean(isFeatured);
  await product.save();
  return res.json({ product: product.toJSON() });
});

router.get("/orders", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email phone")
      .populate("items.seller", "name storeName")
      .sort({ createdAt: -1 });
    
    const result = orders.map(order => {
      const json = order.toJSON();
      return json;
    });

    return res.json({ orders: result });
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to fetch orders" });
  }
});

// ===== MARKETER MANAGEMENT =====

// Get all marketers
router.get("/marketers", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const marketers = await User.find({ role: "marketer" }).sort({ createdAt: -1 });
    
    // Get stats for each marketer
    const marketersWithStats = await Promise.all(
      marketers.map(async marketer => {
        const coupons = await Coupon.find({ marketer: marketer.id });
        const commissions = await Commission.find({ marketer: marketer.id });
        const unpaidCommissions = await Commission.find({ marketer: marketer.id, isPaid: false });
        
        return {
          ...marketer.toJSON(),
          stats: {
            totalCoupons: coupons.length,
            activeCoupons: coupons.filter(c => c.isActive).length,
            totalOrders: commissions.length,
            totalEarnings: commissions.reduce((sum, c) => sum + c.commissionAmount, 0),
            pendingPayout: unpaidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
          },
        };
      })
    );

    return res.json({ marketers: marketersWithStats });
  } catch (error) {
    console.error("Get marketers error:", error);
    return res.status(500).json({ message: "Failed to fetch marketers" });
  }
});

// Create new marketer
router.post("/marketers", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, phone, couponCode, commissionRate } = req.body || {};
    
    if (!name || !email || !password || !couponCode) {
      return res.status(400).json({ message: "Name, email, password, and coupon code are required" });
    }

    // Check if email already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (existingCoupon) {
      return res.status(409).json({ message: "Coupon code already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const marketer = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "marketer",
      phone,
    });

    // Create coupon for the marketer
    await Coupon.create({
      code: couponCode.toUpperCase(),
      marketer: marketer.id,
      commissionRate: commissionRate || 5,
      isActive: true,
    });

    return res.status(201).json({ marketer: marketer.toJSON() });
  } catch (error) {
    console.error("Create marketer error:", error);
    return res.status(500).json({ message: "Failed to create marketer" });
  }
});

// Delete marketer
router.delete("/marketers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const marketer = await User.findById(req.params.id);
    if (!marketer || marketer.role !== "marketer") {
      return res.status(404).json({ message: "Marketer not found" });
    }

    // Delete associated coupons and commissions
    await Coupon.deleteMany({ marketer: marketer.id });
    await Commission.deleteMany({ marketer: marketer.id });
    await marketer.deleteOne();
    
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete marketer error:", error);
    return res.status(500).json({ message: "Failed to delete marketer" });
  }
});

// Get marketer coupons
router.get("/marketers/:id/coupons", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const marketer = await User.findById(req.params.id);
    if (!marketer || marketer.role !== "marketer") {
      return res.status(404).json({ message: "Marketer not found" });
    }

    const coupons = await Coupon.find({ marketer: marketer.id });
    return res.json({ coupons: coupons.map(c => c.toJSON()) });
  } catch (error) {
    console.error("Get marketer coupons error:", error);
    return res.status(500).json({ message: "Failed to fetch coupons" });
  }
});

// Add new coupon for marketer
router.post("/marketers/:id/coupons", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const marketer = await User.findById(req.params.id);
    if (!marketer || marketer.role !== "marketer") {
      return res.status(404).json({ message: "Marketer not found" });
    }

    const { code, commissionRate } = req.body || {};
    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(409).json({ message: "Coupon code already exists" });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      marketer: marketer.id,
      commissionRate: commissionRate || 5,
      isActive: true,
    });

    return res.status(201).json({ coupon: coupon.toJSON() });
  } catch (error) {
    console.error("Add coupon error:", error);
    return res.status(500).json({ message: "Failed to create coupon" });
  }
});

// Toggle coupon active status
router.patch("/coupons/:id/toggle", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return res.json({ coupon: coupon.toJSON() });
  } catch (error) {
    console.error("Toggle coupon error:", error);
    return res.status(500).json({ message: "Failed to toggle coupon" });
  }
});

// Get weekly commissions for payout
router.get("/marketers/:id/commissions/weekly", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const marketer = await User.findById(req.params.id);
    if (!marketer || marketer.role !== "marketer") {
      return res.status(404).json({ message: "Marketer not found" });
    }

    // Aggregate by week
    const weeklyCommissions = await Commission.aggregate([
      { $match: { marketer: marketer._id } },
      {
        $group: {
          _id: {
            weekStart: "$weekStart",
            weekEnd: "$weekEnd",
            isPaid: "$isPaid",
          },
          totalOrders: { $sum: 1 },
          totalCommission: { $sum: "$commissionAmount" },
          paidAt: { $first: "$paidAt" },
        },
      },
      { $sort: { "_id.weekStart": -1 } },
    ]);

    const formatted = weeklyCommissions.map(week => ({
      weekStart: week._id.weekStart,
      weekEnd: week._id.weekEnd,
      totalOrders: week.totalOrders,
      totalCommission: week.totalCommission,
      isPaid: week._id.isPaid,
      paidAt: week.paidAt,
    }));

    return res.json({ weeks: formatted });
  } catch (error) {
    console.error("Get weekly commissions error:", error);
    return res.status(500).json({ message: "Failed to fetch commissions" });
  }
});

// Mark week as paid
router.post("/marketers/:id/commissions/pay", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const marketer = await User.findById(req.params.id);
    if (!marketer || marketer.role !== "marketer") {
      return res.status(404).json({ message: "Marketer not found" });
    }

    const { weekStart, weekEnd } = req.body || {};
    if (!weekStart || !weekEnd) {
      return res.status(400).json({ message: "Week start and end dates required" });
    }

    // Mark all commissions for this week as paid
    const result = await Commission.updateMany(
      {
        marketer: marketer.id,
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        isPaid: false,
      },
      {
        $set: {
          isPaid: true,
          paidAt: new Date(),
        },
      }
    );

    return res.json({ success: true, paidCount: result.modifiedCount });
  } catch (error) {
    console.error("Mark paid error:", error);
    return res.status(500).json({ message: "Failed to mark as paid" });
  }
});

export default router;
