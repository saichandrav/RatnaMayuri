import bcrypt from "bcryptjs";
import User from "../models/User.js";

export const seedDemoCustomer = async () => {
  const email = (process.env.DEMO_CUSTOMER_EMAIL || "customer@ratnamayuri.demo").toLowerCase();
  const password = process.env.DEMO_CUSTOMER_PASSWORD || "Customer@123";

  let customer = await User.findOne({ email });
  if (customer) {
    return customer;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  customer = await User.create({
    name: "ratnamayuri Demo Customer",
    email,
    passwordHash,
    role: "customer",
  });

  return customer;
};
