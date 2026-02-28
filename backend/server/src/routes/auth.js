import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const OTP_TTL_MINUTES = 10;

const getMailTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const sendResetOtpEmail = async ({ to, otp, name }) => {
  const transport = getMailTransport();
  if (!transport) {
    throw new Error("Email service not configured");
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = "Your password reset code";
  const text = [
    `Hi ${name || "there"},`,
    "",
    `Your password reset code is: ${otp}`,
    `This code expires in ${OTP_TTL_MINUTES} minutes.`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  await transport.sendMail({ from, to, subject, text });
};

const createToken = user =>
  jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: "customer" });

  const token = createToken(user.toJSON());
  return res.status(201).json({ token, user: user.toJSON() });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = createToken(user.toJSON());
  return res.json({ token, user: user.toJSON() });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    user.resetOtpHash = otpHash;
    user.resetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await user.save();

    try {
      await sendResetOtpEmail({ to: user.email, otp, name: user.name });
    } catch (error) {
      console.error("Failed to send reset OTP", error);
      return res.status(500).json({ message: "Failed to send reset code" });
    }
  }

  return res.json({ message: "If the email exists, a reset code has been sent" });
});

router.post("/reset-password", async (req, res) => {
  const { email, otp, password } = req.body || {};
  if (!email || !otp || !password) {
    return res.status(400).json({ message: "Email, otp, and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
    return res.status(400).json({ message: "Invalid reset code" });
  }

  if (user.resetOtpExpiresAt.getTime() < Date.now()) {
    return res.status(400).json({ message: "Reset code expired" });
  }

  const otpHash = crypto.createHash("sha256").update(String(otp)).digest("hex");
  const matches = crypto.timingSafeEqual(Buffer.from(otpHash), Buffer.from(user.resetOtpHash));
  if (!matches) {
    return res.status(400).json({ message: "Invalid reset code" });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetOtpHash = null;
  user.resetOtpExpiresAt = null;
  await user.save();

  return res.json({ message: "Password reset successful" });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({ user: user.toJSON() });
});

export default router;
