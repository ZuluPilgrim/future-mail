/**
 * Admin Role Middleware
 *
 * Must be used AFTER authMiddleware (requires req.user to be set).
 * Checks the database for the user's current role — does not trust
 * the role embedded in the JWT, since roles can change after token issue.
 *
 * Returns 403 if the user is not an admin.
 */
const { userQueries } = require('../db/database');

module.exports = function adminMiddleware(req, res, next) {
  const user = userQueries.findById.get(req.user.id);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
