const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const Review = require('../models/Review');
const { isAuthenticated } = require('../middleware/auth');

// Setup multer storage for avatar uploads
const avatarUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueSuffix = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueSuffix);
  }
});

const upload = multer({
  storage,
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
        avatarUrl: user.avatarUrl || '/images/default-avatar.png',
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
 * @desc    Update bio/description (username/name is strictly read-only and blocked)
 */
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user?.id || req.session.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { bio } = req.body;
    // Strictly update bio only. Name/username changes are completely ignored and blocked.
    if (bio !== undefined) {
      user.bio = String(bio).trim();
    }

    await user.save();

    // Sync session
    if (req.session.user) {
      req.session.user.bio = user.bio;
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatarUrl: user.avatarUrl || '/images/default-avatar.png'
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error updating profile.' });
  }
});

/**
 * @route   POST /api/users/avatar
 * @desc    Upload avatar picture (supports multer file upload and base64 JSON payload)
 */
router.post('/avatar', isAuthenticated, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
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
      avatarPath = `/uploads/avatars/${req.file.filename}`;
    } else if (req.body && req.body.avatar && typeof req.body.avatar === 'string') {
      // 2. Check base64 data URI
      const base64Str = req.body.avatar;
      if (base64Str.startsWith('data:image/')) {
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
      } else if (base64Str.startsWith('/')) {
        avatarPath = base64Str;
      }
    }

    if (!avatarPath) {
      return res.status(400).json({ success: false, message: 'Please select a valid image file.' });
    }

    user.avatarUrl = avatarPath;
    await user.save();

    if (req.session.user) {
      req.session.user.avatarUrl = avatarPath;
    }

    return res.json({
      success: true,
      message: 'Avatar updated successfully.',
      avatarUrl: avatarPath
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
