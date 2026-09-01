
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { connectRedis } = require('../config/redis');
const { sendotp } = require('./sendotp');

const CACHE_TTL_USERNAME = parseInt(process.env.USERNAME_REDIS_TTL, 10) || 60;
const CACHE_TTL_EMAIL = parseInt(process.env.EMAIL_REDIS_TTL, 10) || 60;

async function setuser(req, res) {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    let client = null;
    try {
      client = await connectRedis();
      if (client && client.isOpen) {
        const cachedUsername = await client.get(`user_exists:${normalizedUsername}`);
        if (cachedUsername) {
          return res.status(400).json({ message: 'Username already taken' });
        }

        const cachedEmail = await client.get(`email_exists:${normalizedEmail}`);
        if (cachedEmail) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }
    } catch (_) {}

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    }).lean();

    if (existingUser) {
      if (existingUser.username === normalizedUsername) {
        try { if (client && client.isOpen) await client.setEx(`user_exists:${normalizedUsername}`, CACHE_TTL_USERNAME, 'exists'); } catch (_) {}
        return res.status(400).json({ message: 'Username already taken' });
      }
      if (existingUser.email === normalizedEmail) {
        try { if (client && client.isOpen) await client.setEx(`email_exists:${normalizedEmail}`, CACHE_TTL_EMAIL, 'exists'); } catch (_) {}
        return res.status(400).json({ message: 'Email already registered' });
      }
    }

    await sendotp(normalizedUsername, normalizedEmail, password, name.trim());
    return res.status(200).json({ success: true, message: 'Signup successful' });
  } catch (error) {
    console.error('Error in setuser:', error.message);
    return res.status(500).json({ message: error.message || 'Server error', error: error.message });
  }
}

module.exports = setuser;