const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Streams a buffer to Cloudinary and returns the secure URL and public_id.
 * Uses resource_type: 'auto' so images, PDFs, and office documents are handled properly.
 *
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {string} originalName - Original filename
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
function uploadToCloudinary(buffer, originalName) {
  return new Promise((resolve, reject) => {
    // Generate clean public_id from timestamp + sanitized filename
    const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const publicId = `classbridge_${Date.now()}_${cleanName}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        public_id: publicId,
        folder: 'classbridge_attachments',
      },
      (error, result) => {
        if (error) {
          console.error('[CLOUDINARY] Upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

module.exports = { cloudinary, uploadToCloudinary };
