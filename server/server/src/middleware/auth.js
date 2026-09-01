

require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const secret = process.env.JWT_SECRET || 'jwt_default_secret_key';

  // 1. Extract token from cookies or Authorization Bearer header
  let token = req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, secret);
      req.user = { ...decoded, isGuest: false };
      return next();
    } catch {
      return res.status(403).json({ error: 'Invalid token' });
    }
  }

  // 2. Extract guest token
  let guestToken = req.cookies?.guest_token;
  if (!guestToken && req.headers['x-guest-token']) {
    guestToken = req.headers['x-guest-token'];
  }

  if (guestToken) {
    try {
      const decoded = jwt.verify(guestToken, secret);
      req.user = { ...decoded, isGuest: true };
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid guest session' });
    }
  }

  // 3. Unauthenticated
  return res.status(401).json({ error: 'Authentication required' });
};

const requireAuth = (req, res, next) => {
  if (!req.user || req.user.isGuest) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticateToken, requireAuth, requireAdmin };