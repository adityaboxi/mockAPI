require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function sync_auth(req, res) {
  const token =
    req.cookies?.token ||
    req.headers['x-auth-token'] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  const guestToken = req.cookies?.guest_token || req.headers['x-guest-token'];

  if (!token) {
    if (guestToken) {
      try {
        const decodedGuest = jwt.verify(guestToken, process.env.JWT_SECRET || 'local_dev_secret_change_me');
        if (decodedGuest.role === 'guest') {
          return res.status(200).json({
            user: {
              role: 'guest',
              isGuest: true,
              subscribe: false,
              sessionId: decodedGuest.sessionId,
            },
          });
        }
      } catch (_) {}
    }
    return res.status(401).json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'local_dev_secret_change_me');
    const user = await User.findById(decoded.id || decoded.userId).select('-password').lean();

    if (!user) {
      return res.status(401).json({ user: null });
    }

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        subscribe: user.subscribe === true,
      },
    });
  } catch (error) {
    return res.status(401).json({ user: null });
  }
}

module.exports = sync_auth;