require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { connectRedis } = require('../config/redis');
const jwt = require('jsonwebtoken');

async function otp_verify(req, res) {
  const { email, username, otp, password, name } = req.body;

  if (!email || !username || !otp || !password || !name) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const key = `${normalizedUsername}_${normalizedEmail}`;

  try {
    const client = await connectRedis();
    const storedOTP = await client.get(key);
    if (!storedOTP || otp !== storedOTP) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }
    await client.del(key);

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    }).lean();

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      name: name.trim(),
      role: 'user',
    });

    const jwtSecret = process.env.JWT_SECRET || 'jwt_default_secret_key';
    const jwtExpiry = process.env.JWT_EXPIRY || '7d';
    const cookieMaxAge = parseInt(process.env.COOKIE_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000;
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === 'true';
    const sameSite = process.env.COOKIE_SAMESITE || (isHttps ? 'none' : 'lax');
    const isSecure = isHttps;

    const token = jwt.sign(
      {
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        id: newUser._id,
        userId: newUser._id,
        role: 'user',
      },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: cookieMaxAge,
      path: '/',
    });

    await client.del(key);
    await client.del(`user_exists:${normalizedUsername}`);
    await client.del(`email_exists:${normalizedEmail}`);

    res.clearCookie('guest_token', {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite,
    });

    return res.json({
      success: true,
      token,
      message: 'OTP verified successfully',
      user: {
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: 'user',
      },
    });
  } catch (error) {
    console.error('OTP verification error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = otp_verify;