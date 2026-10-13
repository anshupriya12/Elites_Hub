const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const FOLDER = "wanderlust_DEV";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: FOLDER,
    // Cloudinary's upload option is `allowed_formats` (snake_case); camelCase is silently ignored.
    allowed_formats: ["png", "jpg", "jpeg", "webp"],
  },
});

// Deletes an image that was uploaded during the current request (req.file). It only ever touches assets inside
// this app's upload folder, so listings seeded with external image URLs are never affected.
const deleteUploadedImage = async (file) => {
  if (!file || typeof file.filename !== "string" || !file.filename.startsWith(`${FOLDER}/`)) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(file.filename, { invalidate: true });
  } catch (err) {
    console.error("Could not remove an uploaded image from Cloudinary:", err && err.message);
  }
};

module.exports = {
  cloudinary,
  storage,
  deleteUploadedImage,
};
