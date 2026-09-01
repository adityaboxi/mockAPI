require('../opentelemetry/universal-logger');

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

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const sameSite = process.env.COOKIE_SAMESITE || (isHttps ? 'none' : 'lax');
    const jwtSecret = process.env.JWT_SECRET || 'jwt_default_secret_key';
    const jwtExpiry = process.env.JWT_EXPIRY || '7d';
    const cookieMaxAge = parseInt(process.env.COOKIE_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000;

    res.clearCookie('guest_token', {
      httpOnly: true,
      secure: isHttps,
      sameSite,
      path: '/',
    });

    // 1. Sign JWT Token with User Payload
    const token = jwt.sign(
      {
        id: user._id,
        userId: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
      },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    // 2. Set HttpOnly Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite,
      maxAge: cookieMaxAge,
      path: '/',
    });

    // 3. Return JSON Token + User metadata
    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        subscribe: Boolean(user.subscribe),
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = login;