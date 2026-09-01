
require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const User = require('../models/User');
const { redisClient } = require('../config/redis');
const { sendotp } = require('./sendotp');

const CACHE_TTL_USERNAME = parseInt(process.env.USERNAME_REDIS_TTL, 10) || 60;
const CACHE_TTL_EMAIL = parseInt(process.env.EMAIL_REDIS_TTL, 10) || 60;

async function setuser(req, res) {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ message: 'All fields (name, email, username, password) are required' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();

  try {
    if (redisClient && redisClient.isOpen) {
      const cachedUsername = await redisClient.get(`user_exists:${cleanUsername}`);
      if (cachedUsername) {
        return res.status(409).json({ message: 'Username is already taken' });
      }

      const cachedEmail = await redisClient.get(`email_exists:${cleanEmail}`);
      if (cachedEmail) {
        return res.status(409).json({ message: 'Email is already registered' });
      }
    }

    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      if (redisClient && redisClient.isOpen) {
        await redisClient.setEx(`user_exists:${cleanUsername}`, CACHE_TTL_USERNAME, '1');
      }
      return res.status(409).json({ message: 'Username is already taken' });
    }

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      if (redisClient && redisClient.isOpen) {
        await redisClient.setEx(`email_exists:${cleanEmail}`, CACHE_TTL_EMAIL, '1');
      }
      return res.status(409).json({ message: 'Email is already registered' });
    }

    await sendotp(cleanUsername, cleanEmail, password, cleanName);

    return res.status(200).json({
      success: true,
      message: 'Signup verification code sent to your email',
    });
  } catch (error) {
    console.error('[setuser] Error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = setuser;