const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user and establish session
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    // Role defaults to 'user' unless explicitly specified and permitted
    const assignedRole = role === 'admin' ? 'admin' : 'user';

    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole
    });

    // Initialize session
    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '/images/default-avatar.png',
      bio: user.bio || ''
    };

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: req.session.user
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Registration failed',
      message: error.message || 'Registration failed'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and create session
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Store user info in session
    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '/images/default-avatar.png',
      bio: user.bio || ''
    };

    return res.json({
      success: true,
      message: 'Login successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during login.'
    });
  }
});

/**
 * @route   POST /api/auth/admin-login
 * @desc    Authenticate admin user and create admin session
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both admin email and password.'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    if (user.role !== 'admin' && user.role !== 'master_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not possess administrator credentials.'
      });
    }

    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '/images/default-avatar.png',
      bio: user.bio || ''
    };

    return res.json({
      success: true,
      message: 'Admin authentication successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during admin login.'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Destroy session and log out
 */
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Unable to log out. Please try again.'
        });
      }
      res.clearCookie('connect.sid');
      return res.json({
        success: true,
        message: 'Logged out successfully.'
      });
    });
  } else {
    return res.json({
      success: true,
      message: 'No active session found.'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user from session with fresh DB sync
 */
router.get('/me', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.userId;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User session invalid.'
      });
    }

    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '/images/default-avatar.png',
      bio: user.bio || ''
    };

    return res.json({
      success: true,
      user: req.session.user
    });
  } catch (err) {
    return res.json({
      success: true,
      user: req.session.user
    });
  }
});

module.exports = router;
