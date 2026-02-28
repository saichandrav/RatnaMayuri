import { v2 as cloudinary } from "cloudinary";

// Support both CLOUDINARY_URL and individual env variables
let config = {};

if (process.env.CLOUDINARY_URL) {
  // Parse CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name
  const url = new URL(process.env.CLOUDINARY_URL);
  config = {
    cloud_name: url.hostname,
    api_key: url.username,
    api_secret: url.password,
  };
} else {
  // Fall back to individual environment variables
  config = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
}

cloudinary.config(config);

export default cloudinary;
