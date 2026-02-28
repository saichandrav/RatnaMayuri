import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    total: { type: Number, required: true },
    couponCode: { type: String, trim: true, uppercase: true, default: null },
    couponDiscount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["payment_pending", "confirmed", "packed", "shipped", "delivered", "cancelled"],
      default: "payment_pending",
    },
    tracking: {
      type: [
        {
          status: { type: String, required: true },
          message: { type: String, trim: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    shippingAddress: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: "India" },
    },
    payment: {
      provider: { type: String, trim: true, default: "razorpay" },
      orderId: { type: String, trim: true },
      amount: { type: Number },
      currency: { type: String, trim: true },
      paymentId: { type: String, trim: true },
      signature: { type: String, trim: true },
      status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
    },
  },
  { timestamps: true }
);

orderSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Order", orderSchema);
