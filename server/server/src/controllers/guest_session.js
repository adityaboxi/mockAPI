
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const jwt = require('jsonwebtoken');

async function guestSession(req, res) {
  try {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === 'true';
    const sameSite = process.env.COOKIE_SAMESITE || (isHttps ? 'none' : 'lax');
    const isSecure = isHttps;
    const jwtSecret = process.env.JWT_SECRET || 'jwt_default_secret_key';
    const jwtExpiry = process.env.JWT_EXPIRY || '7d';
    const cookieMaxAge = parseInt(process.env.COOKIE_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000;

    // Only clear token if explicit guest request
    if (!req.cookies?.token) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        path: '/',
      });
    }

    const guestToken = jwt.sign(
      {
        role: 'guest',
        timestamp: Date.now(),
        sessionId: Math.random().toString(36).substring(2, 10),
      },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    res.cookie('guest_token', guestToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: cookieMaxAge,
      path: '/',
    });

    return res.json({
      success: true,
      token: guestToken,
      role: 'guest',
      subscribe: false,
      message: 'Guest session created',
    });
  } catch (error) {
    console.error('Guest session error:', error.message);
    return res.status(500).json({ error: 'Failed to create guest session' });
  }
}

module.exports = guestSession;