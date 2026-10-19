const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product model or name'],
      trim: true,
      maxlength: [120, 'Product name cannot exceed 120 characters']
    },
    brand: {
      type: String,
      trim: true,
      default: 'Community',
      maxlength: [60, 'Brand name cannot exceed 60 characters']
    },
    description: {
      type: String,
      default: '',
      maxlength: [3000, 'Description cannot exceed 3000 characters']
    },
    category: {
      type: String,
      required: [true, 'Please provide a category'],
      enum: ['Smartphones', 'Laptops', 'Audio', 'Accessories', 'Wearables', 'Other'],
      trim: true
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price must be non-negative']
    },
    imageUrl: {
      type: String,
      default: ''
    },
    images: [
      {
        type: String
      }
    ],
    numReviews: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative']
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative']
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative']
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative']
    },
    specifications: [
      {
        key: { type: String, trim: true },
        value: { type: String, trim: true }
      }
    ],
    specs: {
      type: Map,
      of: String,
      default: {}
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Product', productSchema);
