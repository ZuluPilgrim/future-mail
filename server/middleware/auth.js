/**
 * JWT Authentication Middleware
 *
 * Verifies the Bearer token in the Authorization header.
 * On success, attaches the decoded payload to req.user:
 *   { id, email, name, role }
 *
 * Used on all protected routes. Must come before adminMiddleware.
 */
const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, name, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
