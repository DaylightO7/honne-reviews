const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Review = require('../models/Review');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { cleanCloudinaryImage } = require('../utils/cleanImage');

/**
 * @route   GET /api/products
 * @desc    Get all products with category filter, search (name or brand), and computed ratings
 */
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    // Strict query condition: only products with verified reviews (> 0)
    // Find all product IDs that currently have active, non-removed reviews
    const activeProductIds = await Review.distinct('product', { isRemoved: { $ne: true } });

    const conditions = [
      {
        $or: [
          { numReviews: { $gt: 0 } },
          { reviewCount: { $gt: 0 } },
          { totalReviews: { $gt: 0 } },
          { _id: { $in: activeProductIds } }
        ]
      }
    ];

    if (category && category !== 'All') {
      conditions.push({ category });
    }

    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      conditions.push({
        $or: [
          { name: searchRegex },
          { brand: searchRegex },
          { category: searchRegex }
        ]
      });
    }

    const filter = { $and: conditions };

    const products = await Product.find(filter).sort({ createdAt: -1 });

    // Compute live average rating and review count (ignoring removed reviews)
    const rawProductList = await Promise.all(
      products.map(async (prod) => {
        const reviews = await Review.find({ product: prod._id, isRemoved: { $ne: true } }).sort({ createdAt: -1 });
        const reviewCount = reviews.length;

        // If product has 0 active reviews, delete orphaned product record from MongoDB immediately
        if (reviewCount === 0) {
          try {
            await Product.findByIdAndDelete(prod._id);
            if (prod.imageUrl) {
              await cleanCloudinaryImage(prod.imageUrl);
            }
          } catch (delErr) {
            console.warn('Error removing orphaned product:', delErr.message);
          }
          return null;
        }

        const avgRating = Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1));

        // Sync stored counters on product if needed
        if (prod.numReviews !== reviewCount || prod.totalReviews !== reviewCount || prod.reviewCount !== reviewCount || prod.averageRating !== avgRating) {
          Product.findByIdAndUpdate(prod._id, {
            numReviews: reviewCount,
            totalReviews: reviewCount,
            reviewCount: reviewCount,
            averageRating: avgRating
          }).catch(() => {});
        }

        // Rank reviews by net score: likes - dislikes
        const scoredReviews = reviews.map(r => ({
          review: r,
          netScore: (r.likes || []).length - (r.dislikes || []).length
        })).sort((a, b) => b.netScore - a.netScore || new Date(b.review.createdAt) - new Date(a.review.createdAt));

        // Use highest net-score review with image as card thumbnail
        let thumbUrl = prod.imageUrl;
        const revWithImg = scoredReviews.find(item => item.review.images && item.review.images.length > 0);
        if (revWithImg) {
          thumbUrl = revWithImg.review.images[0];
        }
        if (!thumbUrl || thumbUrl === '') {
          thumbUrl = '/images/default-gadget.svg';
        }

        // Dynamically take card snippet from the review with highest net score
        let bestSnippet = prod.description || 'No reviews submitted yet.';
        if (scoredReviews.length > 0) {
          const topComment = scoredReviews[0].review.comment;
          if (topComment && topComment.trim() !== '') {
            bestSnippet = topComment.trim();
          }
        }

        // Clean truncation with ellipsis (...)
        const maxSnippetLength = 140;
        let truncatedSnippet = bestSnippet;
        if (truncatedSnippet.length > maxSnippetLength) {
          truncatedSnippet = truncatedSnippet.substring(0, maxSnippetLength).trim() + '...';
        }

        return {
          ...prod.toObject(),
          imageUrl: thumbUrl,
          price: Number(prod.price) || 0,
          description: bestSnippet,
          snippet: truncatedSnippet,
          averageRating: avgRating,
          numReviews: reviewCount,
          totalReviews: reviewCount,
          reviewCount: reviewCount
        };
      })
    );

    // Filter out nulls and any products with 0 reviews
    const productList = rawProductList.filter(item => item !== null && (item.reviewCount > 0 || item.totalReviews > 0 || item.numReviews > 0));

    return res.json({
      success: true,
      count: productList.length,
      data: productList
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching products.'
    });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get single product details with dynamic top-rated banner (logo & description), specs, and reviews
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const currentUserId = req.session?.user?.id ? req.session.user.id.toString() : null;

    // Fetch active/approved reviews only
    const reviews = await Review.find({
      product: req.params.id,
      isRemoved: { $ne: true }
    })
      .populate('user', 'name avatarUrl bio')
      .sort({ createdAt: -1 });

    const totalReviews = reviews.length;
    if (totalReviews === 0) {
      try {
        await Product.findByIdAndDelete(req.params.id);
        if (product.imageUrl) {
          await cleanCloudinaryImage(product.imageUrl);
        }
      } catch (delErr) {
        console.warn('Error removing orphaned product:', delErr.message);
      }
      return res.status(404).json({
        success: false,
        message: 'Product not found or has no verified reviews.'
      });
    }

    const avgRating = Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1));

    // Rating breakdown (1 to 5 stars)
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      if (breakdown[r.rating] !== undefined) {
        breakdown[r.rating] += 1;
      }
    });

    // Check if the current user has already reviewed this product
    const userExistingReview = currentUserId
      ? reviews.find(r => r.user && r.user._id && r.user._id.toString() === currentUserId)
      : null;

    // Calculate net score for each review: likes - dislikes
    const scoredReviews = reviews.map(r => {
      const likesCount = (r.likes || []).length;
      const dislikesCount = (r.dislikes || []).length;
      const netScore = likesCount - dislikesCount;
      return {
        review: r,
        netScore,
        likesCount,
        dislikesCount
      };
    });

    // Sort reviews descending by netScore (secondary: newest first)
    const sortedByNetScore = [...scoredReviews].sort((a, b) => {
      if (b.netScore !== a.netScore) {
        return b.netScore - a.netScore;
      }
      return new Date(b.review.createdAt) - new Date(a.review.createdAt);
    });

    // 1. Dynamic Featured Description: Highest netScore review text (or fallback)
    let featuredDescription = 'No reviews submitted yet.';
    if (sortedByNetScore.length > 0) {
      featuredDescription = sortedByNetScore[0].review.comment || 'No reviews submitted yet.';
    }

    // 2. Dynamic Main Product Logo/Image: Highest netScore review with at least one uploaded image
    const reviewWithImages = sortedByNetScore.find(item => item.review.images && item.review.images.length > 0);
    let mainImageUrl = '';
    if (reviewWithImages && reviewWithImages.review.images.length > 0) {
      mainImageUrl = reviewWithImages.review.images[0];
    } else if (product.imageUrl && product.imageUrl.trim() !== '') {
      mainImageUrl = product.imageUrl;
    } else {
      mainImageUrl = '/images/default-gadget.svg';
    }

    // Sanitize reviews for public: hide flag counts completely from regular visitors
    const sanitizedReviews = reviews.map(r => {
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
          avatarUrl: r.user?.avatarUrl || '/images/default-avatar.png',
          bio: r.user?.bio || ''
        },
        createdAt: r.createdAt
      };
    });

    return res.json({
      success: true,
      data: {
        ...product.toObject(),
        description: featuredDescription,
        featuredDescription: featuredDescription,
        imageUrl: mainImageUrl,
        price: Number(product.price) || 0,
        averageRating: avgRating,
        numReviews: totalReviews,
        totalReviews,
        reviewCount: totalReviews,
        ratingBreakdown: breakdown,
        specifications: product.specifications || [],
        hasUserReviewed: !!userExistingReview,
        userReviewId: userExistingReview ? userExistingReview._id : null
      },
      reviews: sanitizedReviews
    });
  } catch (error) {
    console.error('Fetch product by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching product details.'
    });
  }
});

/**
 * @route   PUT /api/products/:id/specs
 * @desc    Update key-value specifications for a product (Admin / Master Admin only)
 */
router.put('/:id/specs', isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const { specifications } = req.body;
    let formattedSpecs = [];

    if (Array.isArray(specifications)) {
      formattedSpecs = specifications
        .filter(item => item && typeof item === 'object')
        .map(item => ({
          key: String(item.key || '').trim(),
          value: String(item.value || '').trim()
        }))
        .filter(item => item.key !== '' && item.value !== '');
    } else if (specifications && typeof specifications === 'object') {
      formattedSpecs = Object.entries(specifications)
        .map(([key, value]) => ({
          key: String(key || '').trim(),
          value: String(value || '').trim()
        }))
        .filter(item => item.key !== '' && item.value !== '');
    }

    product.specifications = formattedSpecs;
    await product.save();

    return res.json({
      success: true,
      message: 'Product specifications updated successfully.',
      data: {
        specifications: product.specifications
      }
    });
  } catch (error) {
    console.error('Update specifications error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating specifications.'
    });
  }
});

/**
 * @route   POST /api/products
 * @desc    Create a product (Logged-in users / Admin)
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { name, brand, description, category, price, imageUrl, specs } = req.body;

    if (!name || !brand || !description || !category || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, brand, description, category, and price.'
      });
    }

    const product = await Product.create({
      name,
      brand,
      description,
      category,
      price: Number(price),
      imageUrl: imageUrl || '',
      specs: specs || {},
      createdBy: req.session.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Product added successfully.',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating product.'
    });
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (admin or creator)
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const isCreator = product.createdBy && product.createdBy.toString() === req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to delete this product.'
      });
    }

    const reviews = await Review.find({ product: product._id });
    for (const rev of reviews) {
      if (rev.images && Array.isArray(rev.images)) {
        for (const img of rev.images) {
          await cleanCloudinaryImage(img);
        }
      }
    }
    await Review.deleteMany({ product: product._id });
    await Product.findByIdAndDelete(req.params.id);
    if (product.imageUrl) {
      await cleanCloudinaryImage(product.imageUrl);
    }

    return res.json({
      success: true,
      message: 'Product and associated reviews deleted.'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting product.'
    });
  }
});

module.exports = router;
