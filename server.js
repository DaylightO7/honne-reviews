const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = require('./config/db');
connectDB();

const app = express();

// Middleware: CORS
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// Middleware: Body parsers (support up to 8 uploaded images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware: Session with MongoStore
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/web_review_hub';
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'web_review_hub_secret_key',
    resave: false,
    saveUninitialized: false,
    store: (MongoStore.create ? MongoStore : MongoStore.default).create({
      mongoUrl: mongoURI,
      collectionName: 'sessions',
      ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  })
);

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Public platform stats endpoint
const Review = require('./models/Review');
const Product = require('./models/Product');
app.get('/api/stats', async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments({ isRemoved: false });
    const totalProducts = await Product.countDocuments();
    return res.json({
      success: true,
      totalReviews,
      totalProducts
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching stats'
    });
  }
});

// Fallback for unknown API routes (404)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server] HonneReviews running on http://localhost:${PORT}`);
  console.log(`[Environment] Mode: ${process.env.NODE_ENV || 'development'}`);
});
