import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryId: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

imageSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.url = ret.cloudinaryUrl;
    delete ret._id;
    delete ret.__v;
    delete ret.cloudinaryId; // Don't expose internal IDs in JSON
    return ret;
  },
});

export default mongoose.model("Image", imageSchema);
