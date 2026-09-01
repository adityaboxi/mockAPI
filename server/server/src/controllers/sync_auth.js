require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = 60; // 1 minute

async function sync_auth(req, res) {
  let token = req.cookies?.token;
  if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token && req.headers?.['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (!token) {
    return res.status(401).json({ user: null });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'jwt_default_secret_key';
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.id || decoded.userId || decoded._id;
    const username = decoded.username;

    if (!userId && !username) {
      return res.status(401).json({ user: null });
    }

    const cacheKey = `user_profile:${userId || username}`;
    try {
      const client = await connectRedis();
      const cached = await client.get(cacheKey);
      if (cached) {
        return res.json({ user: JSON.parse(cached) });
      }
    } catch (_) {}

    const query = userId ? { _id: userId } : { username: username.toLowerCase().trim() };
    let user = await User.findOne(query).select('-password').lean();
    if (!user && username) {
      user = await User.findOne({ username: username.toLowerCase().trim() }).select('-password').lean();
    }

    if (!user) {
      return res.status(401).json({ user: null });
    }

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      subscribe: Boolean(user.subscribe),
      noofProjects: user.noofProjects || 0,
    };

    try {
      const client = await connectRedis();
      await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(userData));
    } catch (_) {}

    return res.json({ user: userData });
  } catch (error) {
    return res.status(401).json({ user: null });
  }
}

module.exports = sync_auth;