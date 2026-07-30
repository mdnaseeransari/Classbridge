const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

// ─── Verify JWT and attach decoded user to req.user ───────────────────────────
/**
 * Middleware: authenticate any request that carries a valid JWT.
 * Sets req.user = { id, role, status } from the token payload.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const token = authHeader.slice(7); // strip "Bearer "

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.';
      return res.status(401).json({ error: message });
    }

    // Fetch a fresh copy from DB so bans/status changes take effect immediately
    const user = await User.findById(decoded.id).select('_id role status isLocked isBanned');
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been banned. Contact an administrator.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account has been rejected.' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval.' });
    }
    if (user.isLocked) {
      return res.status(403).json({
        error: 'Your account is locked due to too many failed login attempts. Contact an administrator.',
      });
    }

    req.user = { id: user._id.toString(), role: user.role, status: user.status };
    return next();
  } catch (err) {
    console.error('[AUTH] authenticate error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

// ─── Role guard factory ───────────────────────────────────────────────────────
/**
 * Middleware factory: restricts a route to specific roles.
 * Must be used AFTER authenticate().
 *
 * @param {...string} allowedRoles - One or more role strings that are permitted.
 * @returns Express middleware function.
 *
 * Usage:
 *   router.get('/admin/users', authenticate, requireRole('admin', 'superadmin'), handler)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
      });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
