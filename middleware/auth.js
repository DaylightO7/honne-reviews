/**
 * Session-based authentication and authorization middleware
 */

// Verify that the user has an active session
const isAuthenticated = (req, res, next) => {
  if (req.session && (req.session.user || req.session.userId)) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized. Please log in to access this resource.'
  });
};

// Verify that the authenticated user possesses admin or master_admin role
const isAdmin = (req, res, next) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin' || req.session.user.role === 'master_admin') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator privileges required.'
    });
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized. Please log in.'
  });
};

// Verify that the authenticated user is strictly the master_admin
const isMasterAdmin = (req, res, next) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'master_admin') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Master Administrator privileges required.'
    });
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized. Please log in.'
  });
};

// Generic role verification middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please log in.'
      });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role must be one of: ${roles.join(', ')}.`
      });
    }

    next();
  };
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isMasterAdmin,
  requireRole
};
