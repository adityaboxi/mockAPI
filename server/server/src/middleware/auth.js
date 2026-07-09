const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    const guestToken = req.cookies.guest_token;
    if (guestToken) {
      try {
        const decoded = jwt.verify(guestToken, process.env.JWT_SECRET);
        req.user = { ...decoded, isGuest: true };
        return next();
      } catch (err) {
        return res.status(401).json({ error: 'Invalid guest session' });
      }
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { ...decoded, isGuest: false };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user || req.user.isGuest || req.user.role === 'guest') {
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