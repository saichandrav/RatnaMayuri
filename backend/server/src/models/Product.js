import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ["jewellery", "saree"], required: true },
    subCategory: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    description: { type: String, required: true },
    images: { type: [String], default: [] },
    stock: { type: Number, default: 0 },
    rating: { type: Number, default: 4.6 },
    reviewCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

productSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    if (ret.seller && ret.seller._id) {
      ret.seller = {
        id: ret.seller._id.toString(),
        name: ret.seller.storeName || ret.seller.name,
      };
    }
    return ret;
  },
});

export default mongoose.model("Product", productSchema);
