const jwt = require('jsonwebtoken');

async function guestSession(req, res) {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE,
      path: '/'
    });

    const guestToken = jwt.sign(
      { 
        role: 'guest', 
        timestamp: Date.now(), 
        sessionId: Math.random().toString(36).substring(7) 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );

    res.cookie('guest_token', guestToken, {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE,
      maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10),
      path: '/'
    });

    res.json({ 
      success: true, 
      role: 'guest', 
      subscribe: false,
      message: 'Guest session created' 
    });
  } catch (error) {
    console.error('Guest session error:', error);
    res.status(500).json({ error: 'Failed to create guest session' });
  }
}

module.exports = guestSession;