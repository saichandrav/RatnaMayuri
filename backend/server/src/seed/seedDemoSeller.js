import bcrypt from "bcryptjs";
import User from "../models/User.js";

export const seedDemoSeller = async () => {
  const email = (process.env.DEMO_SELLER_EMAIL || "seller@ratnamayuri.demo").toLowerCase();
  const password = process.env.DEMO_SELLER_PASSWORD || "Seller@123";

  let seller = await User.findOne({ email });
  if (seller) {
    return seller;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  seller = await User.create({
    name: "ratnamayuri Demo Seller",
    email,
    passwordHash,
    role: "seller",
    storeName: "ratnamayuri",
  });

  return seller;
};
