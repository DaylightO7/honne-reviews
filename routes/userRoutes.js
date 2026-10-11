const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const User = require('../models/User');
const Review = require('../models/Review');
const { isAuthenticated } = require('../middleware/auth');

// Configure Cloudinary credentials from environment
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Fallback disk storage for avatars if Cloudinary credentials are not set (e.g. offline local dev)
const avatarUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueSuffix = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueSuffix);
  }
});

const avatarCloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'honne_avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }]
  }
});

const avatarStorage = isCloudinaryConfigured ? avatarCloudinaryStorage : avatarDiskStorage;

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

/**
 * Helper: Extract the stored file URL or path from a multer uploaded avatar file object
 */
function getUploadedAvatarPath(file) {
  if (!file) return '';
  // Multer-storage-cloudinary sets file.path (or secure_url) to full Cloudinary HTTPS URL
  if (file.path && (file.path.startsWith('http://') || file.path.startsWith('https://'))) {
    return file.path;
  }
  if (file.secure_url) {
    return file.secure_url;
  }
  return `/uploads/avatars/${file.filename}`;
}

/**
 * @route   GET /api/users/profile
 * @desc    Get logged-in user profile, bio, avatar, and aggregated reputation
 */
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user?.id || req.session.userId;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Aggregate reputation across user's active reviews
    const userReviews = await Review.find({ user: user._id, isRemoved: { $ne: true } });
    const totalLikes = userReviews.reduce((sum, r) => sum + (r.likes ? r.likes.length : 0), 0);
    const totalDislikes = userReviews.reduce((sum, r) => sum + (r.dislikes ? r.dislikes.length : 0), 0);

    return res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || user.avatar || '/images/default-avatar.png',
        avatar: user.avatarUrl || user.avatar || '/images/default-avatar.png',
        createdAt: user.createdAt
      },
      stats: {
        totalLikes,
        totalDislikes,
        reviewCount: userReviews.length
      }
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
});

/**
 * @route   PUT /api/users/profile
 * @route   PATCH /api/users/profile
 * @route   PUT /api/users/me
 * @route   PATCH /api/users/me
 * @desc    Update bio/description and optional avatar
 */
const updateProfileHandler = async (req, res) => {
  try {
    const userId = req.session.user?.id || req.session.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { bio, avatar, avatarUrl } = req.body;
    // Strictly update bio only. Name/username changes are completely ignored and blocked.
    if (bio !== undefined) {
      user.bio = String(bio).trim();
    }

    const avatarInput = avatar || avatarUrl;
    if (avatarInput && typeof avatarInput === 'string') {
      if (avatarInput.startsWith('data:image/')) {
        if (isCloudinaryConfigured) {
          try {
            const uploadResult = await cloudinary.uploader.upload(avatarInput, {
              folder: 'honne_avatars',
              transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }]
            });
            if (uploadResult && (uploadResult.secure_url || uploadResult.url)) {
              user.avatarUrl = uploadResult.secure_url || uploadResult.url;
              user.avatar = user.avatarUrl;
            }
          } catch (cloudErr) {
            console.error('Cloudinary avatar upload in profile update error:', cloudErr);
          }
        }
      } else if (avatarInput.startsWith('http://') || avatarInput.startsWith('https://')) {
        user.avatarUrl = avatarInput;
        user.avatar = avatarInput;
      }
    }

    await user.save();

    // Sync session
    if (req.session.user) {
      req.session.user.bio = user.bio;
      if (user.avatarUrl) {
        req.session.user.avatarUrl = user.avatarUrl;
        req.session.user.avatar = user.avatarUrl;
      }
    }

    await new Promise((resolve) => {
      if (req.session.save) {
        req.session.save(resolve);
      } else {
        resolve();
      }
    });

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatarUrl: user.avatarUrl || user.avatar || '/images/default-avatar.png',
        avatar: user.avatarUrl || user.avatar || '/images/default-avatar.png'
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error updating profile.' });
  }
};

router.put('/profile', isAuthenticated, updateProfileHandler);
router.patch('/profile', isAuthenticated, updateProfileHandler);
router.put('/me', isAuthenticated, updateProfileHandler);
router.patch('/me', isAuthenticated, updateProfileHandler);

/**
 * @route   POST /api/users/avatar
 * @desc    Upload avatar picture (supports multer file upload and base64 JSON payload)
 */
router.post('/avatar', isAuthenticated, (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload error.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const userId = req.session.user?.id || req.session.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let avatarPath = '';

    // 1. Check if multer processed a file
    if (req.file) {
      avatarPath = getUploadedAvatarPath(req.file);
    } else if (req.body && (req.body.avatar || req.body.avatarUrl) && typeof (req.body.avatar || req.body.avatarUrl) === 'string') {
      // 2. Check base64 data URI
      const base64Str = req.body.avatar || req.body.avatarUrl;
      if (base64Str.startsWith('data:image/')) {
        if (isCloudinaryConfigured) {
          try {
            const uploadResult = await cloudinary.uploader.upload(base64Str, {
              folder: 'honne_avatars',
              transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }]
            });
            if (uploadResult && (uploadResult.secure_url || uploadResult.url)) {
              avatarPath = uploadResult.secure_url || uploadResult.url;
            }
          } catch (cloudErr) {
            console.error('Cloudinary avatar base64 upload error:', cloudErr);
          }
        }

        // Fallback: local disk write if Cloudinary is not configured or failed
        if (!avatarPath) {
          const match = base64Str.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (match) {
            let ext = match[1].toLowerCase();
            if (ext === 'jpeg') ext = 'jpg';
            if (ext.includes('+')) ext = ext.split('+')[0];
            const filename = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
            const filePath = path.join(avatarUploadDir, filename);
            fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
            avatarPath = `/uploads/avatars/${filename}`;
          }
        }
      } else if (base64Str.startsWith('http://') || base64Str.startsWith('https://') || base64Str.startsWith('/')) {
        avatarPath = base64Str;
      }
    }

    if (!avatarPath) {
      return res.status(400).json({ success: false, message: 'Please select a valid image file.' });
    }

    user.avatarUrl = avatarPath;
    user.avatar = avatarPath;
    await user.save();

    if (req.session.user) {
      req.session.user.avatarUrl = avatarPath;
      req.session.user.avatar = avatarPath;
    }

    await new Promise((resolve) => {
      if (req.session.save) {
        req.session.save(resolve);
      } else {
        resolve();
      }
    });

    return res.json({
      success: true,
      message: 'Avatar updated successfully.',
      avatarUrl: avatarPath,
      avatar: avatarPath
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error updating avatar.' });
  }
});

/**
 * @route   GET /api/users/my-reviews
 * @route   GET /api/users/me/reviews
 * @desc    Get all reviews authored by the logged-in user
 */
const getMyReviewsHandler = async (req, res) => {
  try {
    const userId = req.session.user?.id || req.session.userId;
    const reviews = await Review.find({ user: userId })
      .populate('product', 'name brand category imageUrl images price')
      .sort({ createdAt: -1 });

    const formattedReviews = reviews.map(r => {
      const prodThumb = (r.product?.imageUrl && r.product.imageUrl !== '/images/default-gadget.svg' && r.product.imageUrl.trim() !== '')
        ? r.product.imageUrl
        : ((r.product?.images && r.product.images.length > 0 && r.product.images[0]) || (r.images && r.images.length > 0 && r.images[0]) || '');

      return {
        _id: r._id,
        product: r.product ? {
          _id: r.product._id,
          name: r.product.name,
          brand: r.product.brand,
          category: r.product.category,
          imageUrl: prodThumb || r.product.imageUrl || '',
          image: prodThumb || r.product.imageUrl || '',
          images: r.product.images || [],
          price: r.product.price || 0
        } : {
          _id: null,
          name: 'Product Unlisted',
          brand: '',
          category: '',
          imageUrl: (r.images && r.images[0]) || '',
          image: (r.images && r.images[0]) || '',
          images: [],
          price: 0
        },
        heading: r.heading || '',
        comment: r.comment,
        rating: r.rating,
        images: r.images || [],
        likesCount: (r.likes || []).length,
        dislikesCount: (r.dislikes || []).length,
        netScore: (r.likes || []).length - (r.dislikes || []).length,
        isRemoved: r.isRemoved || false,
        createdAt: r.createdAt
      };
    });

    return res.json({
      success: true,
      count: formattedReviews.length,
      data: formattedReviews
    });
  } catch (error) {
    console.error('Fetch my-reviews error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching user reviews.' });
  }
};

router.get('/my-reviews', isAuthenticated, getMyReviewsHandler);
router.get('/me/reviews', isAuthenticated, getMyReviewsHandler);

/**
 * @route   GET /api/users/:id
 * @desc    Public user profile view: avatar, name, bio, aggregated reputation, and public reviews
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    const currentUserId = req.session?.user?.id ? req.session.user.id.toString() : (req.session?.userId ? req.session.userId.toString() : null);
    const isOwner = currentUserId && currentUserId === user._id.toString();

    // Fetch all active reviews posted by this user
    const reviews = await Review.find({
      user: user._id,
      isRemoved: { $ne: true }
    })
      .populate('product', 'name brand category imageUrl images price')
      .sort({ createdAt: -1 });

    const totalLikes = reviews.reduce((sum, r) => sum + (r.likes ? r.likes.length : 0), 0);
    const totalDislikes = reviews.reduce((sum, r) => sum + (r.dislikes ? r.dislikes.length : 0), 0);

    const publicReviews = reviews.map(r => {
      const prodThumb = (r.product?.imageUrl && r.product.imageUrl !== '/images/default-gadget.svg' && r.product.imageUrl.trim() !== '')
        ? r.product.imageUrl
        : ((r.product?.images && r.product.images.length > 0 && r.product.images[0]) || (r.images && r.images.length > 0 && r.images[0]) || '');

      return {
        _id: r._id,
        product: r.product ? {
          _id: r.product._id,
          name: r.product.name,
          brand: r.product.brand,
          category: r.product.category,
          imageUrl: prodThumb || r.product.imageUrl || '',
          image: prodThumb || r.product.imageUrl || '',
          images: r.product.images || [],
          price: r.product.price || 0
        } : {
          _id: null,
          name: 'Product Unlisted',
          brand: '',
          category: '',
          imageUrl: (r.images && r.images[0]) || '',
          image: (r.images && r.images[0]) || '',
          images: [],
          price: 0
        },
        heading: r.heading || '',
        comment: r.comment,
        rating: r.rating,
        images: r.images || [],
        likesCount: (r.likes || []).length,
        dislikesCount: (r.dislikes || []).length,
        netScore: (r.likes || []).length - (r.dislikes || []).length,
        createdAt: r.createdAt
      };
    });

    return res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '/images/default-avatar.png',
        createdAt: user.createdAt
      },
      stats: {
        totalLikes,
        totalDislikes,
        reviewCount: reviews.length
      },
      reviews: publicReviews,
      isOwner: Boolean(isOwner)
    });
  } catch (error) {
    console.error('Fetch public profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching user profile.' });
  }
});

module.exports = router;
