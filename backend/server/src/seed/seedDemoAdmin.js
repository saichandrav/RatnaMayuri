import bcrypt from "bcryptjs";
import User from "../models/User.js";

export const seedDemoAdmin = async () => {
  const email = (process.env.DEMO_ADMIN_EMAIL || "admin@ratnamayuri.demo").toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD || "Admin@123";

  let admin = await User.findOne({ email });
  if (admin) {
    return admin;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  admin = await User.create({
    name: "ratnamayuri Admin",
    email,
    passwordHash,
    role: "admin",
  });

  return admin;
};
