/*const User = require('../models/User');
const { redisClient } = require('../config/redis');

const CACHE_TTL = parseInt(process.env.EMAIL_REDIS_TTL);

async function isemailvalid(req, res) {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  
  try {
    const value = await redisClient.get(email);
    if (value) {
      await redisClient.expire(email, CACHE_TTL);
      return res.status(409).json({ message: 'Email already registered' });
    }
    
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      await redisClient.setEx(email, CACHE_TTL, 'exists');
      return res.status(409).json({ message: 'Email already registered' });
    }

    res.status(200).json({ valid: true, message: 'Email is valid' });
  } catch (error) {
    console.error('Email validation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = isemailvalid;*/


const User = require('../models/User');
const { redisClient } = require('../config/redis');

const CACHE_TTL = parseInt(process.env.EMAIL_REDIS_TTL, 10) || 60;

async function isemailvalid(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    // 1. Check Redis cache
    const cached = await redisClient.get(email);
    if (cached) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // 2. Check database
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      // Cache the fact that this email exists for 60 seconds
      await redisClient.setEx(email, CACHE_TTL, 'exists');
      return res.status(409).json({ message: 'Email already registered' });
    }

    // 3. Email is valid – optionally cache for a short period to avoid DB hits
    // (We are not caching valid emails to keep logic simple; you can add if desired)

    return res.status(200).json({ valid: true, message: 'Email is valid' });
  } catch (error) {
    console.error('[email-validation] Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = isemailvalid;