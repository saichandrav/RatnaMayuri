import express from "express";
import Product from "../models/Product.js";
import { requireAuth, requireRole, requireRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { search, category, subCategory, seller, featured } = req.query;
  const query = {};

  if (category) {
    query.category = category;
  }

  if (subCategory) {
    query.subCategory = new RegExp(`^${subCategory}$`, "i");
  }

  if (seller) {
    query.seller = seller;
  }

  if (featured === "true") {
    query.isFeatured = true;
  }

  if (search) {
    const regex = new RegExp(search, "i");
    query.$or = [
      { name: regex },
      { description: regex },
      { category: regex },
      { subCategory: regex },
    ];
  }

  const products = await Product.find(query).populate("seller", "name storeName");
  return res.json({ products: products.map(product => product.toJSON()) });
});

router.get("/:id", async (req, res) => {
  const product = await Product.findById(req.params.id).populate("seller", "name storeName");
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json({ product: product.toJSON() });
});

router.post("/", requireAuth, requireRoles(["seller", "admin"]), async (req, res) => {
  const payload = req.body || {};
  const isAdmin = req.user.role === "admin";
  const product = await Product.create({
    name: payload.name,
    category: payload.category,
    subCategory: payload.subCategory,
    price: payload.price,
    originalPrice: payload.originalPrice || undefined,
    description: payload.description,
    images: payload.images || [],
    stock: payload.stock || 0,
    rating: payload.rating || 4.7,
    reviewCount: payload.reviewCount || 0,
    isFeatured: isAdmin ? Boolean(payload.isFeatured) : false,
    seller: isAdmin && payload.seller ? payload.seller : req.user.id,
  });

  const populated = await product.populate("seller", "name storeName");
  return res.status(201).json({ product: populated.toJSON() });
});

router.put("/:id", requireAuth, requireRoles(["seller", "admin"]), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const isOwner = product.seller.toString() === req.user.id;
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: "You do not own this product" });
  }

  const payload = req.body || {};
  product.name = payload.name ?? product.name;
  product.category = payload.category ?? product.category;
  product.subCategory = payload.subCategory ?? product.subCategory;
  product.price = payload.price ?? product.price;
  product.originalPrice = payload.originalPrice ?? product.originalPrice;
  product.description = payload.description ?? product.description;
  product.images = payload.images ?? product.images;
  product.stock = payload.stock ?? product.stock;
  if (isOwner && req.user.role !== "seller") {
    product.isFeatured = payload.isFeatured ?? product.isFeatured;
  } else if (isAdmin) {
    const allowedKeys = ["isFeatured"];
    const invalidKey = Object.keys(payload).find(key => !allowedKeys.includes(key));
    if (invalidKey) {
      return res.status(403).json({ message: "Admins can only toggle featured flag here" });
    }
    product.isFeatured = Boolean(payload.isFeatured);
  }

  await product.save();
  const populated = await product.populate("seller", "name storeName");
  return res.json({ product: populated.toJSON() });
});

router.delete("/:id", requireAuth, requireRole("seller"), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (product.seller.toString() !== req.user.id) {
    return res.status(403).json({ message: "You do not own this product" });
  }

  await product.deleteOne();
  return res.json({ success: true });
});

export default router;
