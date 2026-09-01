require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = parseInt(process.env.USERNAME_REDIS_TTL, 10) || 60;

async function isvalidusername(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(normalizedUsername)) {
    return res.status(400).json({ message: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }

  try {
    const client = await connectRedis();
    const value = await client.get(`user_exists:${normalizedUsername}`);
    if (value) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const usernameExists = await User.findOne({ username: normalizedUsername }).lean();
    if (usernameExists) {
      await client.setEx(`user_exists:${normalizedUsername}`, CACHE_TTL, 'exists');
      return res.status(409).json({ message: 'Username already taken' });
    }

    return res.status(200).json({ valid: true, message: 'Username is valid' });
  } catch (error) {
    console.error('Username validation error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = isvalidusername;