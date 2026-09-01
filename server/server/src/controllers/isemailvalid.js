require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = parseInt(process.env.EMAIL_REDIS_TTL, 10) || 60;

async function isemailvalid(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const client = await connectRedis();
    const value = await client.get(`email_exists:${normalizedEmail}`);
    if (value) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const emailExists = await User.findOne({ email: normalizedEmail }).lean();
    if (emailExists) {
      await client.setEx(`email_exists:${normalizedEmail}`, CACHE_TTL, 'exists');
      return res.status(409).json({ message: 'Email already registered' });
    }

    return res.status(200).json({ valid: true, message: 'Email is valid' });
  } catch (error) {
    console.error('Email validation error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = isemailvalid;