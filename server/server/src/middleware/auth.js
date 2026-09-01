require('../opentelemetry/universal-logger');

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const secret = process.env.JWT_SECRET || 'jwt_default_secret_key';

  // 1. Check Cookies, Authorization Header, or x-auth-token Header
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }
  if (!token && req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, secret);
      req.user = { ...decoded, isGuest: false };
      return next();
    } catch {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // 2. Fallback to Guest Token
  let guestToken = req.cookies?.guest_token || req.headers['x-guest-token'];
  if (guestToken) {
    try {
      const decoded = jwt.verify(guestToken, secret);
      req.user = { ...decoded, isGuest: true };
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid guest session' });
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
};

const requireAuth = (req, res, next) => {
  if (!req.user || req.user.isGuest) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

module.exports = { authenticateToken, requireAuth };