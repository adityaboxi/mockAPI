require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const User = require('../models/User');
const jwt = require('jsonwebtoken');

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isProd = process.env.NODE_ENV === 'production';

    res.clearCookie('guest_token', {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      secure: isProd,
      path: '/',
    });

    const token = jwt.sign(
      { 
        username: user.username, 
        email: user.email, 
        name: user.name, 
        role: user.role || 'user',
        userId: user._id,
      },
      process.env.JWT_SECRET || 'local_dev_secret_change_me',
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.cookie('token', token, { 
      httpOnly: true, 
      sameSite: process.env.COOKIE_SAMESITE || 'lax', 
      secure: isProd,
      maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 604800000,
      path: '/',
    });

    return res.status(200).json({ 
      success: true,
      user: {
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    console.error('[login] Error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = login;