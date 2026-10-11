const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { isAdmin, isMasterAdmin } = require('../middleware/auth');

// Apply isAdmin middleware to all admin endpoints
router.use(isAdmin);

/**
 * @route   POST /api/admin/create-admin
 * @desc    Create a new sub-admin (Master Admin only)
 * @access  Master Admin Only
 */
router.post('/create-admin', isMasterAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    const newAdmin = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    return res.status(201).json({
      success: true,
      message: `Administrator '${newAdmin.name}' created successfully.`,
      data: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating administrator.'
    });
  }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Metrics overview for admin dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const [userCount, productCount, reviewCount, flaggedCount, removedCount] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Review.countDocuments(),
      Review.countDocuments({ 'flaggedBy.0': { $exists: true }, isRemoved: false }),
      Review.countDocuments({ isRemoved: true })
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers: userCount,
        totalProducts: productCount,
        totalReviews: reviewCount,
        flaggedReviews: flaggedCount,
        removedReviews: removedCount
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching stats.'
    });
  }
});

/**
 * @route   GET /api/admin/reviews/flagged
 * @desc    List all reviews that have been flagged or removed for moderation
 */
router.get('/reviews/flagged', async (req, res) => {
  try {
    const reviews = await Review.find({
      $or: [
        { 'flaggedBy.0': { $exists: true } },
        { isRemoved: true }
      ]
    })
      .populate('user', 'name email')
      .populate('product', 'name brand')
      .populate('flaggedBy', 'name email')
      .sort({ updatedAt: -1 });

    return res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Fetch flagged reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching moderation reviews.'
    });
  }
});

/**
 * @route   GET /api/admin/reviews/all
 * @desc    Get all reviews in system with moderation info
 */
router.get('/reviews/all', async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name email')
      .populate('product', 'name brand')
      .populate('flaggedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Fetch all reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching reviews.'
    });
  }
});

/**
 * @route   POST /api/admin/reviews/:id/dismiss
 * @desc    Dismiss flags on a review (clears flaggedBy and restores isRemoved = false)
 */
router.post('/reviews/:id/dismiss', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

    review.flaggedBy = [];
    review.isRemoved = false;
    await review.save();

    return res.json({
      success: true,
      message: 'Flags dismissed. Review is marked safe and restored to public view.'
    });
  } catch (error) {
    console.error('Dismiss flags error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error dismissing flags.'
    });
  }
});

/**
 * @route   POST /api/admin/reviews/:id/flag
 * @desc    Flag a review from the admin dashboard (Multi-admin flagging)
 */
router.post('/reviews/:id/flag', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

    const adminId = req.session.user.id;
    const alreadyFlagged = review.flaggedBy.some(id => id.toString() === adminId);

    if (alreadyFlagged) {
      return res.status(400).json({
        success: false,
        message: 'You have already flagged this review.',
        flagCount: review.flaggedBy.length,
        isRemoved: review.isRemoved
      });
    }

    review.flaggedBy.push(adminId);
    if (review.flaggedBy.length >= 3) {
      review.isRemoved = true;
    }
    await review.save();

    return res.json({
      success: true,
      message: review.isRemoved
        ? 'Review reached 3 admin flags and has been auto-removed.'
        : `Review flagged. Current flags: ${review.flaggedBy.length} / 3.`,
      flagCount: review.flaggedBy.length,
      isRemoved: review.isRemoved
    });
  } catch (error) {
    console.error('Admin flag error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while flagging review.'
    });
  }
});

/**
 * @route   DELETE /api/admin/reviews/:id
 * @desc    Directly delete a review from moderation panel
 */
router.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Review permanently deleted.'
    });
  } catch (error) {
    console.error('Admin delete review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting review.'
    });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get user accounts
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching users.'
    });
  }
});

module.exports = router;
