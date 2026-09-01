require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const jwt = require('jsonwebtoken');

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  try {
    const normalizedUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === 'true';
    const sameSite = process.env.COOKIE_SAMESITE || (isHttps ? 'none' : 'lax');
    const isSecure = isHttps;
    const jwtSecret = process.env.JWT_SECRET || 'jwt_default_secret_key';
    const jwtExpiry = process.env.JWT_EXPIRY || '7d';
    const cookieMaxAge = parseInt(process.env.COOKIE_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000;

    res.clearCookie('guest_token', {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      path: '/',
    });

    const token = jwt.sign(
      {
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        userId: user._id,
        id: user._id,
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

    return res.json({
      success: true,
      token,
      user: {
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        subscribe: Boolean(user.subscribe),
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = login;