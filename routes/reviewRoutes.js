const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Setup multer storage for review photo uploads
const reviewUploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(reviewUploadDir)) {
  fs.mkdirSync(reviewUploadDir, { recursive: true });
}

const reviewStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reviewUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
    cb(null, uniqueSuffix);
  }
});

const uploadReviewPhotos = multer({
  storage: reviewStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

/**
 * Helper: Save up to 8 uploaded images (base64 or static paths) to public/uploads
 */
function processAndSaveImages(imagesArray) {
  if (!Array.isArray(imagesArray)) return [];
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const savedPaths = [];
  const maxImages = Math.min(imagesArray.length, 8);

  for (let i = 0; i < maxImages; i++) {
    const imgStr = imagesArray[i];
    if (!imgStr || typeof imgStr !== 'string') continue;

    // Check for base64 data URI
    if (imgStr.startsWith('data:image/')) {
      const match = imgStr.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        if (ext.includes('+')) ext = ext.split('+')[0];
        const base64Data = match[2];
        const filename = `rev-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        savedPaths.push(`/uploads/${filename}`);
        continue;
      }
    }

    // Standard static path or URL
    if (imgStr.startsWith('/') || imgStr.startsWith('http')) {
      savedPaths.push(imgStr);
    }
  }

  return savedPaths;
}

/**
 * @route   POST /api/reviews
 * @desc    Submit a review with heading, rating, text, and up to 8 images
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { productId, productName, category, price, heading, comment, rating, images } = req.body;

    if (!comment || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Review content and star rating are required.'
      });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5.'
      });
    }

    const numericPrice = (price !== undefined && !isNaN(Number(price)) && Number(price) >= 0)
      ? Number(price)
      : 0;

    // Process and store up to 8 images
    const savedImages = processAndSaveImages(images || []);

    // Resolve or create product
    let targetProduct = null;
    if (productId) {
      targetProduct = await Product.findById(productId);
    }

    if (!targetProduct && productName && productName.trim() !== '') {
      const trimmedName = productName.trim();
      targetProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
      });

      if (!targetProduct) {
        // Derive brand from first word
        const brandName = trimmedName.split(' ')[0] || 'Community';
        targetProduct = await Product.create({
          name: trimmedName,
          brand: brandName,
          category: category || 'Other',
          description: heading ? `${heading}. ${comment.substring(0, 200)}` : comment.substring(0, 200),
          price: numericPrice,
          imageUrl: savedImages[0] || '',
          images: savedImages,
          createdBy: req.session.user.id
        });
      }
    }

    if (!targetProduct) {
      return res.status(400).json({
        success: false,
        message: 'Valid Product ID or Product Name is required.'
      });
    }

    // Update product price if user submitted a valid positive price
    let productUpdated = false;
    if (numericPrice > 0) {
      targetProduct.price = numericPrice;
      productUpdated = true;
    }

    // If product has no thumbnail image, update it with first uploaded image
    if ((!targetProduct.imageUrl || targetProduct.imageUrl === '') && savedImages.length > 0) {
      targetProduct.imageUrl = savedImages[0];
      if (!targetProduct.images || targetProduct.images.length === 0) {
        targetProduct.images = savedImages;
      }
      productUpdated = true;
    }

    if (productUpdated) {
      await targetProduct.save();
    }

    // Check if user already reviewed this product
    const currentUserId = req.session.user?.id || req.session.userId;
    const existingReview = await Review.findOne({
      product: targetProduct._id,
      user: currentUserId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already posted a review for this product. You can edit your existing submission from your profile.',
        message: 'You have already posted a review for this product. You can edit your existing submission from your profile.'
      });
    }

    const review = await Review.create({
      product: targetProduct._id,
      user: currentUserId,
      heading: heading || '',
      rating: numericRating,
      comment,
      images: savedImages,
      likes: [],
      dislikes: [],
      flaggedBy: [],
      isRemoved: false
    });

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name avatarUrl bio')
      .populate('product', 'name brand category imageUrl price');

    return res.status(201).json({
      success: true,
      message: 'Review published successfully.',
      data: populatedReview,
      productId: targetProduct._id
    });
  } catch (error) {
    console.error('Create review error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'You have already posted a review for this product. You can edit your existing submission from your profile.',
        message: 'You have already posted a review for this product. You can edit your existing submission from your profile.'
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while submitting review.'
    });
  }
});

/**
 * @route   GET /api/reviews/check-user-review
 * @desc    Check whether the logged-in user has already reviewed a given product
 */
router.get('/check-user-review', async (req, res) => {
  try {
    const { productId, productName } = req.query;
    const currentUserId = req.session?.user?.id || req.session?.userId;
    if (!currentUserId) {
      return res.json({ success: true, hasReviewed: false, reviewId: null });
    }
    let targetProductId = productId;
    if (!targetProductId && productName && productName.trim() !== '') {
      const p = await Product.findOne({ name: { $regex: new RegExp(`^${productName.trim()}$`, 'i') } });
      if (p) targetProductId = p._id;
    }
    if (!targetProductId) {
      return res.json({ success: true, hasReviewed: false, reviewId: null });
    }
    const review = await Review.findOne({ product: targetProductId, user: currentUserId, isRemoved: { $ne: true } });
    return res.json({
      success: true,
      hasReviewed: !!review,
      reviewId: review ? review._id : null
    });
  } catch (error) {
    return res.json({ success: true, hasReviewed: false, reviewId: null });
  }
});

/**
 * @route   GET /api/reviews/product/:productId
 * @desc    Get all active reviews for a product with sorting (Flag counts kept completely hidden from public)
 */
router.get('/product/:productId', async (req, res) => {
  try {
    const { sort } = req.query;
    const currentUserId = req.session?.user?.id ? req.session.user.id.toString() : (req.session?.userId ? req.session.userId.toString() : null);

    const reviews = await Review.find({
      product: req.params.productId,
      isRemoved: { $ne: true }
    })
      .populate('user', 'name avatarUrl bio');

    // Format output: hide flaggedBy count completely from public callers
    let publicReviews = reviews.map(r => {
      const likesArray = r.likes || [];
      const dislikesArray = r.dislikes || [];
      const netScore = likesArray.length - dislikesArray.length;
      return {
        _id: r._id,
        heading: r.heading || '',
        comment: r.comment,
        rating: r.rating,
        images: r.images || [],
        likesCount: likesArray.length,
        dislikesCount: dislikesArray.length,
        netScore: netScore,
        hasLiked: currentUserId ? likesArray.some(id => id.toString() === currentUserId) : false,
        hasDisliked: currentUserId ? dislikesArray.some(id => id.toString() === currentUserId) : false,
        user: {
          _id: r.user?._id,
          name: r.user?.name || 'Verified Buyer',
          avatarUrl: r.user?.avatarUrl || '/images/default-avatar.svg',
          bio: r.user?.bio || ''
        },
        createdAt: r.createdAt
      };
    });

    // Apply sorting
    if (sort === 'net_likes' || sort === 'net_upvotes' || sort === 'highest_upvotes') {
      publicReviews.sort((a, b) => b.netScore - a.netScore || new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'most_disliked') {
      publicReviews.sort((a, b) => b.dislikesCount - a.dislikesCount || new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'oldest') {
      publicReviews.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
      // Default: newest first
      publicReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return res.json({
      success: true,
      count: publicReviews.length,
      data: publicReviews
    });
  } catch (error) {
    console.error('Fetch reviews error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching reviews.'
    });
  }
});

/**
 * @route   POST /api/reviews/:id/like
 * @desc    Toggle Like on a review (removes dislike if present)
 */
router.post('/:id/like', isAuthenticated, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review || review.isRemoved) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

    const userId = req.session.user.id;
    const likesIndex = review.likes.findIndex(id => id.toString() === userId);
    let hasLiked = false;

    if (likesIndex > -1) {
      // Toggle off like
      review.likes.splice(likesIndex, 1);
      hasLiked = false;
    } else {
      // Add like
      review.likes.push(userId);
      hasLiked = true;
      // Remove dislike if present
      const dislikeIndex = review.dislikes.findIndex(id => id.toString() === userId);
      if (dislikeIndex > -1) {
        review.dislikes.splice(dislikeIndex, 1);
      }
    }

    await review.save();

    return res.json({
      success: true,
      likesCount: review.likes.length,
      dislikesCount: review.dislikes.length,
      hasLiked,
      hasDisliked: false
    });
  } catch (error) {
    console.error('Like review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while toggling like.'
    });
  }
});

/**
 * @route   POST /api/reviews/:id/dislike
 * @desc    Toggle Dislike on a review (removes like if present)
 */
router.post('/:id/dislike', isAuthenticated, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review || review.isRemoved) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

    const userId = req.session.user.id;
    const dislikeIndex = review.dislikes.findIndex(id => id.toString() === userId);
    let hasDisliked = false;

    if (dislikeIndex > -1) {
      // Toggle off dislike
      review.dislikes.splice(dislikeIndex, 1);
      hasDisliked = false;
    } else {
      // Add dislike
      review.dislikes.push(userId);
      hasDisliked = true;
      // Remove like if present
      const likeIndex = review.likes.findIndex(id => id.toString() === userId);
      if (likeIndex > -1) {
        review.likes.splice(likeIndex, 1);
      }
    }

    await review.save();

    return res.json({
      success: true,
      likesCount: review.likes.length,
      dislikesCount: review.dislikes.length,
      hasLiked: false,
      hasDisliked
    });
  } catch (error) {
    console.error('Dislike review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while toggling dislike.'
    });
  }
});

/**
 * @route   POST /api/reviews/:id/flag
 * @desc    Flag a review (Admin Only).
 *          If flagged by >= 3 distinct admins, auto-removes review from public listings.
 */
router.post('/:id/flag', isAdmin, async (req, res) => {
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

    // Append current admin ID to flaggedBy
    review.flaggedBy.push(adminId);

    // Auto-remove threshold: 3 distinct admins
    if (review.flaggedBy.length >= 3) {
      review.isRemoved = true;
    }

    await review.save();

    return res.json({
      success: true,
      message: review.isRemoved
        ? 'Review reached 3 admin flags and has been automatically removed from public listings.'
        : `Review flagged. Current flags: ${review.flaggedBy.length} / 3.`,
      flagCount: review.flaggedBy.length,
      isRemoved: review.isRemoved
    });
  } catch (error) {
    console.error('Flag review error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while flagging review.'
    });
  }
});

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review (author or admin)
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

    const isAuthor = review.user.toString() === req.session.user.id;
    const isAdminUser = req.session.user.role === 'admin' || req.session.user.role === 'master_admin';

    if (!isAuthor && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to delete this review.'
      });
    }

    await Review.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: 'Review deleted successfully.'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting review.'
    });
  }
});

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update a review (author or admin) with updated fields and images
 */
router.put('/:id', isAuthenticated, (req, res, next) => {
  uploadReviewPhotos.array('images', 8)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError || err.message === 'Only image files are allowed.') {
        return res.status(400).json({ success: false, message: err.message });
      }
      return next(err);
    }
    next();
  });
}, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }

    const currentUserId = (req.session.user?.id || req.session.userId).toString();
    const isAuthor = review.user.toString() === currentUserId;
    const isAdminUser = req.session.user?.role === 'admin' || req.session.user?.role === 'master_admin';

    if (!isAuthor && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to edit this review.'
      });
    }

    const { heading, comment, rating } = req.body;
    if (heading !== undefined) review.heading = String(heading).trim();
    if (comment !== undefined && String(comment).trim() !== '') review.comment = String(comment).trim();
    if (rating !== undefined) {
      const numRating = Number(rating);
      if (!isNaN(numRating) && numRating >= 1 && numRating <= 5) {
        review.rating = numRating;
      }
    }

    // Handle image management (preserving kept existing images, deleting specified images, appending new files)
    let keptImages = null;

    if (req.body.existingImages !== undefined) {
      if (Array.isArray(req.body.existingImages)) {
        keptImages = req.body.existingImages;
      } else if (typeof req.body.existingImages === 'string') {
        try {
          const parsed = JSON.parse(req.body.existingImages);
          keptImages = Array.isArray(parsed) ? parsed : [req.body.existingImages];
        } catch (e) {
          keptImages = req.body.existingImages.trim() !== '' ? [req.body.existingImages] : [];
        }
      }
    } else if (req.body.deletedImages !== undefined) {
      let deletedList = [];
      if (Array.isArray(req.body.deletedImages)) {
        deletedList = req.body.deletedImages;
      } else if (typeof req.body.deletedImages === 'string') {
        try {
          const parsed = JSON.parse(req.body.deletedImages);
          deletedList = Array.isArray(parsed) ? parsed : [req.body.deletedImages];
        } catch (e) {
          deletedList = [req.body.deletedImages];
        }
      }
      keptImages = (review.images || []).filter(img => !deletedList.includes(img));
    }

    // If keptImages was specified (even as empty array []), use it; otherwise retain existing review.images
    let currentImages = keptImages !== null ? keptImages : (review.images || []);

    // Filter currentImages to make sure they are strings
    currentImages = currentImages.filter(img => typeof img === 'string' && img.trim() !== '');

    // Collect new uploaded files via multer
    const newlyUploadedPaths = (req.files || []).map(file => `/uploads/${file.filename}`);

    // Collect any base64 images passed in body.newImages or body.images (if any)
    let additionalBase64 = [];
    if (req.body.newImages) {
      const raw = Array.isArray(req.body.newImages) ? req.body.newImages : [req.body.newImages];
      additionalBase64 = processAndSaveImages(raw);
    } else if (req.body.images && Array.isArray(req.body.images)) {
      const raw = req.body.images.filter(x => typeof x === 'string' && x.startsWith('data:image/'));
      if (raw.length > 0) {
        additionalBase64 = processAndSaveImages(raw);
      }
    }

    // Combine: existing kept + newly uploaded via multer + any additional base64, capped at 8
    const updatedImages = [...currentImages, ...newlyUploadedPaths, ...additionalBase64].slice(0, 8);
    review.images = updatedImages;

    await review.save();

    const updatedReview = await Review.findById(review._id)
      .populate('user', 'name avatarUrl bio')
      .populate('product', 'name brand category imageUrl price');

    return res.json({
      success: true,
      message: 'Review updated successfully.',
      data: updatedReview
    });
  } catch (error) {
    console.error('Update review error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating review.'
    });
  }
});

module.exports = router;
