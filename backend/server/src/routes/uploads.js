import express from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import Image from "../models/Image.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Store uploads in memory to send to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image uploads are allowed"));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Upload image to Cloudinary and save metadata to MongoDB
router.post("/", requireAuth, requireRole("seller"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to Cloudinary from buffer
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "ratnamayuri",
          resource_type: "auto",
          public_id: `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Save metadata to MongoDB (without binary data)
    const image = await Image.create({
      filename: result.public_id,
      originalName: req.file.originalname,
      cloudinaryUrl: result.secure_url,
      cloudinaryId: result.public_id,
      size: req.file.size,
      uploadedBy: req.user.id,
    });

    return res.json({
      url: image.cloudinaryUrl,
      id: image.id,
      filename: image.filename,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Upload failed" });
  }
});

// Direct image serving (optional: redirect to Cloudinary or serve cached)
router.get("/:id", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Redirect to Cloudinary URL
    return res.redirect(image.cloudinaryUrl);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to retrieve image" });
  }
});

// Error handling
router.use((error, _req, res, _next) => {
  if (error) {
    return res.status(400).json({ message: error.message || "Upload failed" });
  }
  return res.status(500).json({ message: "Upload failed" });
});

export default router;
