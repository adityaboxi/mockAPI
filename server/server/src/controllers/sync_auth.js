const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function sync_auth(req, res) {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ user: null });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id || decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ user: null });
    }
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        subscribe: user.subscribe === true
      }
    });
  } catch (error) {
    console.error('Sync auth error:', error);
    res.status(401).json({ user: null });
  }
}

module.exports = sync_auth;