import { v2 as cloudinary } from 'cloudinary';

// Configure cloudinary from environment variables
// Priority: CLOUDINARY_URL > individual config values

if (process.env.CLOUDINARY_URL) {
  // Use CLOUDINARY_URL if available (recommended)
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
  });
} else {
  // Use individual config values
  cloudinary.config({
    cloud_name:
      process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export default cloudinary;
