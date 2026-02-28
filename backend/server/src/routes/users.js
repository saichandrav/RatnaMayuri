import express from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.put("/me", requireAuth, async (req, res) => {
  const payload = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.name = payload.name ?? user.name;
  user.phone = payload.phone ?? user.phone;
  user.address = {
    line1: payload.address?.line1 ?? user.address?.line1,
    line2: payload.address?.line2 ?? user.address?.line2,
    city: payload.address?.city ?? user.address?.city,
    state: payload.address?.state ?? user.address?.state,
    postalCode: payload.address?.postalCode ?? user.address?.postalCode,
    country: payload.address?.country ?? user.address?.country ?? "India",
  };

  await user.save();
  return res.json({ user: user.toJSON() });
});

export default router;
