/*const jwt = require('jsonwebtoken');
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

module.exports = sync_auth;*/





const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { internalRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

async function sync_auth(req, res) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ user: null });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ user: null });
  }

  const userId = decoded.id || decoded.userId;
  if (!userId) {
    return res.status(401).json({ user: null });
  }

  // Build cache key using username (from decoded token)
  const username = decoded.username;
  const cacheKey = `cache:${username}:sync_auth`;

  try {
    // 1. Try to serve from Redis cache
    const cached = await internalRedis.get(cacheKey);
    if (cached) {
      const userData = JSON.parse(cached);
      return res.json({ user: userData });
    }
  } catch (err) {
    // Redis error – fall through to database
  }

  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({ user: null });
    }

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role, // no fallback – role is set in DB
      subscribe: user.subscribe === true
    };

    // 2. Store in Redis cache
    try {
      await internalRedis.setex(cacheKey, CACHE_TTL, JSON.stringify(userData));
    } catch (err) {
      // Cache set failed – no problem
    }

    return res.json({ user: userData });
  } catch (error) {
    console.error('[sync-auth] Error:', error);
    return res.status(500).json({ user: null });
  }
}

module.exports = sync_auth;