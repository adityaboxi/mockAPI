const User = require('../models/User');
const { redisClient } = require('../config/redis');
const jwt = require('jsonwebtoken');

async function otp_verify(req, res) {
  const { email, username, otp, password, name } = req.body;

  if (!email || !username || !otp || !password || !name) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const key = `${username}_${email}`;

  try {
    const storedOTP = await redisClient.get(key);
    console.log('🔍 Retrieved OTP from Redis:', storedOTP);

    if (!storedOTP || otp !== storedOTP) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = await User.create({
      username,
      email,
      password,
      name,
      role: 'user'
    });

    const token = jwt.sign(
      { username, email, name, id: newUser._id, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE,
      maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10)
    });

    await redisClient.del(key);
    
    res.clearCookie('guest_token', { 
      path: '/', 
      httpOnly: true, 
      sameSite: process.env.COOKIE_SAMESITE 
    });
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
      user: { username, email, name, role: 'user' }
    });
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = otp_verify;