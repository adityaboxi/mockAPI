require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { redisClient } = require('../config/redis');

const CACHE_TTL = parseInt(process.env.USERNAME_REDIS_TTL);

async function isvalidusername(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }

  try {
    const value = await redisClient.get(username);
    if (value) {
      await redisClient.expire(username, CACHE_TTL);
      return res.status(409).json({ message: 'Username already taken' });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      await redisClient.setEx(username, CACHE_TTL, 'exists');
      return res.status(409).json({ message: 'Username already taken' });
    }

    res.status(200).json({ valid: true, message: 'Username is valid' });
  } catch (error) {
    console.error('Username validation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = isvalidusername;


/*
const User = require('../models/User');
const { redisClient } = require('../config/redis');

const CACHE_TTL = parseInt(process.env.USERNAME_REDIS_TTL, 10) || 60;

async function isvalidusername(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }

  try {
    // 1. Check Redis cache
    const cached = await redisClient.get(username);
    if (cached) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    // 2. Check database
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      await redisClient.setEx(username, CACHE_TTL, 'exists');
      return res.status(409).json({ message: 'Username already taken' });
    }

    // 3. Username is valid
    return res.status(200).json({ valid: true, message: 'Username is valid' });
  } catch (error) {
    console.error('[username-validation] Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = isvalidusername;*/