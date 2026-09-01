
require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

async function guestSession(req, res) {
  try {
    const isProd = process.env.NODE_ENV === 'production';

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      secure: isProd,
      path: '/',
    });

    const sessionId = uuidv4();
    const guestToken = jwt.sign(
      { 
        role: 'guest', 
        timestamp: Date.now(), 
        sessionId,
      },
      process.env.JWT_SECRET || 'local_dev_secret_change_me',
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.cookie('guest_token', guestToken, {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      secure: isProd,
      maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 604800000,
      path: '/',
    });

    return res.status(200).json({ 
      success: true, 
      role: 'guest', 
      isGuest: true,
      subscribe: false,
      sessionId,
      message: 'Guest session created successfully',
    });
  } catch (error) {
    console.error('[guest-session] Error:', error.message);
    return res.status(500).json({ error: 'Failed to create guest session' });
  }
}

module.exports = guestSession;