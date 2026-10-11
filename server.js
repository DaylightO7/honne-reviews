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

// Enable proxy trust for reverse proxy deployments (Back4App, Render, Docker SSL termination)
app.set('trust proxy', true);

// Middleware: CORS
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// Middleware: Body parsers (support up to 50MB payload)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware: Session with MongoStore
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/web_review_hub';
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'honne_secure_secret_key_default',
    resave: false,
    saveUninitialized: false,
    store: (MongoStore.create ? MongoStore : MongoStore.default).create({
      mongoUrl: mongoURI,
      collectionName: 'sessions',
      ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
      secure: false, // Allows session cookie to be set behind CloudFront/reverse proxy
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

// Serve static assets from public directory (BEFORE all API routers & 404 handlers)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Explicit HTML Page Routes (direct navigation & extension handling)
const serveView = (file) => (req, res) => res.sendFile(path.join(__dirname, 'public', file));

app.get('/', serveView('index.html'));
app.get('/index', serveView('index.html'));
app.get('/index.html', serveView('index.html'));

app.get('/write-review', serveView('write-review.html'));
app.get('/write-review.html', serveView('write-review.html'));

app.get('/product', serveView('product.html'));
app.get('/product.html', serveView('product.html'));

app.get('/profile', serveView('profile.html'));
app.get('/profile.html', serveView('profile.html'));

app.get('/user', serveView('user.html'));
app.get('/user.html', serveView('user.html'));

app.get('/login', serveView('login.html'));
app.get('/login.html', serveView('login.html'));

app.get('/register', serveView('register.html'));
app.get('/register.html', serveView('register.html'));

app.get('/admin', serveView('admin.html'));
app.get('/admin.html', serveView('admin.html'));

app.get('/admin-login', serveView('admin-login.html'));
app.get('/admin-login.html', serveView('admin-login.html'));

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
