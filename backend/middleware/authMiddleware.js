/**
 * Authentication & Authorization Middleware
 */

function requireStudent(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Student login required'
    });
  }
  if (req.session.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Student account required'
    });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Administrator login required'
    });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Administrator privileges required'
    });
  }
  return next();
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Authentication required'
  });
}

module.exports = {
  requireStudent,
  requireAdmin,
  requireAuth
};
