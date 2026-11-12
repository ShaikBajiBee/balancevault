// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const DB = require('../db');

/**
 * Authenticate JWT token from Authorization header
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required. Please sign in.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = DB.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'The account associated with this token no longer exists.'
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account has been suspended by an administrator.'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token. Please sign in again.'
    });
  }
}

/**
 * Role-Based Access Control (RBAC) guard
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required role: [${roles.join(', ')}]. Current role: ${req.user.role}`
      });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
