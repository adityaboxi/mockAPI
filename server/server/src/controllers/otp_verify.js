require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const User = require('../models/User');
const { redisClient } = require('../config/redis');
const jwt = require('jsonwebtoken');

async function otp_verify(req, res) {
  const { email, username, otp, password, name } = req.body;

  if (!email || !username || !otp || !password || !name) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const key = `${cleanUsername}_${cleanEmail}`;

  try {
    let storedOTP = null;
    if (redisClient && redisClient.isOpen) {
      storedOTP = await redisClient.get(key);
    }

    if (!storedOTP || String(otp).trim() !== storedOTP) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    const existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const newUser = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password,
      name: String(name).trim(),
      role: 'user',
    });

    const isProd = process.env.NODE_ENV === 'production';

    const token = jwt.sign(
      {
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        id: newUser._id,
        role: 'user',
      },
      process.env.JWT_SECRET || 'local_dev_secret_change_me',
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 604800000,
      path: '/',
    });

    res.clearCookie('guest_token', { 
      path: '/', 
      httpOnly: true, 
      secure: isProd,
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
    });

    if (redisClient && redisClient.isOpen) {
      await redisClient.del(key);
      await redisClient.del(`user_exists:${cleanUsername}`);
      await redisClient.del(`email_exists:${cleanEmail}`);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      user: {
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: 'user',
      },
    });
  } catch (error) {
    console.error('[otp_verify] Error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = otp_verify;