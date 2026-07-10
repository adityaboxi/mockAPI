/*const User = require('../models/User');
const { redisClient } = require('../config/redis');
const { sendotp } = require('./sendotp');
const CACHE_TTL_USERNAME = parseInt(process.env.USERNAME_REDIS_TTL, 10);
const CACHE_TTL_EMAIL = parseInt(process.env.EMAIL_REDIS_TTL, 10);
async function setuser(req, res) {
const { name, email, username, password } = req.body;
if (!name || !email || !username || !password) {
return res.status(400).json({ message: 'All fields are required' });
  }
try {
const cachedUsername = await redisClient.get(username);
if (cachedUsername) {
await redisClient.expire(username, CACHE_TTL_USERNAME);
return res.status(400).json({ message: 'Username already taken' });
    }
const cachedEmail = await redisClient.get(email);
if (cachedEmail) {
await redisClient.expire(email, CACHE_TTL_EMAIL);
return res.status(400).json({ message: 'Email already registered' });
    }
const existingUsername = await User.findOne({ username });
if (existingUsername) {
await redisClient.setEx(username, CACHE_TTL_USERNAME, 'exists');
return res.status(400).json({ message: 'Username already taken' });
    }
const existingEmail = await User.findOne({ email });
if (existingEmail) {
await redisClient.setEx(email, CACHE_TTL_EMAIL, 'exists');
return res.status(400).json({ message: 'Email already registered' });
    }
await sendotp(username, email, password, name);
    res.status(200).json({ success: true, message: 'Signup successful' });
  } catch (error) {
    console.error("❌ Error in setuser:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
module.exports = setuser;*/




const User = require('../models/User');
const { redisClient } = require('../config/redis');
const { sendotp } = require('./sendotp');

const CACHE_TTL_USERNAME = parseInt(process.env.USERNAME_REDIS_TTL, 10) || 60;
const CACHE_TTL_EMAIL = parseInt(process.env.EMAIL_REDIS_TTL, 10) || 60;

async function setuser(req, res) {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // 1. Check Redis cache for existing username
    const cachedUsername = await redisClient.get(username);
    if (cachedUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // 2. Check Redis cache for existing email
    const cachedEmail = await redisClient.get(email);
    if (cachedEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // 3. Check database for existing username
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      await redisClient.setEx(username, CACHE_TTL_USERNAME, 'exists');
      return res.status(409).json({ error: 'Username already taken' });
    }

    // 4. Check database for existing email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      await redisClient.setEx(email, CACHE_TTL_EMAIL, 'exists');
      return res.status(409).json({ error: 'Email already registered' });
    }

    // 5. Send OTP
    await sendotp(username, email, password, name);

    return res.status(200).json({ success: true, message: 'Signup successful' });
  } catch (error) {
    console.error('[setuser] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = setuser;