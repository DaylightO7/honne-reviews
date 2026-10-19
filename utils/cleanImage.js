const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary credentials from environment
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Safely clean up image files from Cloudinary or local uploads folder
 * @param {string} imgUrl - URL or path of the image to delete
 */
async function cleanCloudinaryImage(imgUrl) {
  if (!imgUrl || typeof imgUrl !== 'string') return;
  try {
    if (imgUrl.includes('cloudinary.com')) {
      const urlParts = imgUrl.split('/upload/');
      if (urlParts.length > 1) {
        let p = urlParts[1].replace(/^v\d+\//, '');
        const lastDot = p.lastIndexOf('.');
        const publicId = lastDot !== -1 ? p.substring(0, lastDot) : p;
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
        }
      }
    } else if (imgUrl.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '..', 'public', imgUrl.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }
  } catch (err) {
    console.warn('Image cleanup warning:', err.message);
  }
}

module.exports = { cleanCloudinaryImage };
