import express from "express";
import Coupon from "../models/Coupon.js";
import Commission from "../models/Commission.js";
import Order from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Helper to get week boundaries (Monday to Sunday)
const getWeekBoundaries = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
};

// Get marketer dashboard stats
router.get("/dashboard", requireAuth, requireRole("marketer"), async (req, res) => {
  try {
    const marketerId = req.user.id;

    // Get all coupons for this marketer
    const coupons = await Coupon.find({ marketer: marketerId });
    const couponCodes = coupons.map(c => c.code);

    // Get current week boundaries
    const { weekStart, weekEnd } = getWeekBoundaries();

    // Get all-time stats
    const allTimeCommissions = await Commission.find({ marketer: marketerId });
    const totalEarnings = allTimeCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const totalOrders = allTimeCommissions.length;

    // Get current week unpaid commissions
    const currentWeekCommissions = await Commission.find({
      marketer: marketerId,
      weekStart,
      weekEnd,
      isPaid: false,
    }).populate("order", "total createdAt");

    const currentWeekEarnings = currentWeekCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const currentWeekOrders = currentWeekCommissions.length;

    // Get pending payout (all unpaid commissions)
    const unpaidCommissions = await Commission.find({
      marketer: marketerId,
      isPaid: false,
    });
    const pendingPayout = unpaidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);

    // Get coupon usage breakdown
    const couponStats = await Promise.all(
      coupons.map(async coupon => {
        const commissions = await Commission.find({ couponCode: coupon.code });
        const earnings = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
        return {
          code: coupon.code,
          usageCount: coupon.usageCount,
          earnings,
          isActive: coupon.isActive,
        };
      })
    );

    return res.json({
      stats: {
        totalEarnings,
        totalOrders,
        currentWeekEarnings,
        currentWeekOrders,
        pendingPayout,
        activeCoupons: coupons.filter(c => c.isActive).length,
      },
      coupons: couponStats,
      currentWeek: {
        weekStart,
        weekEnd,
        commissions: currentWeekCommissions.map(c => c.toJSON()),
      },
    });
  } catch (error) {
    console.error("Marketer dashboard error:", error);
    return res.status(500).json({ message: "Failed to load dashboard" });
  }
});

// Get weekly commission history
router.get("/commissions/history", requireAuth, requireRole("marketer"), async (req, res) => {
  try {
    const marketerId = req.user.id;

    // Aggregate commissions by week
    const history = await Commission.aggregate([
      { $match: { marketer: marketerId } },
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
      { $limit: 52 }, // Last 52 weeks (1 year)
    ]);

    const formatted = history.map(week => ({
      weekStart: week._id.weekStart,
      weekEnd: week._id.weekEnd,
      totalOrders: week.totalOrders,
      totalCommission: week.totalCommission,
      isPaid: week._id.isPaid,
      paidAt: week.paidAt,
    }));

    return res.json({ history: formatted });
  } catch (error) {
    console.error("Commission history error:", error);
    return res.status(500).json({ message: "Failed to load history" });
  }
});

// Validate coupon (public endpoint for checkout)
router.post("/coupons/validate", async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ message: "Coupon code required" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.status(404).json({ message: "Invalid or expired coupon code" });
    }

    return res.json({
      valid: true,
      code: coupon.code,
      commissionRate: coupon.commissionRate,
    });
  } catch (error) {
    console.error("Coupon validation error:", error);
    return res.status(500).json({ message: "Failed to validate coupon" });
  }
});

export default router;
