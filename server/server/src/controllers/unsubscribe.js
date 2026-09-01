require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const User = require('../models/User');
const { redisClient } = require('../config/redis');

async function unsubscribe(req, res) {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.subscribe === false) {
      return res.status(400).json({ error: 'Not currently subscribed' });
    }

    user.subscribe = false;
    await user.save();

    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.del(`dashboard:${username}`);
        await redisClient.del(`user:projects:${username}`);
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscribe: false,
    });
  } catch (error) {
    console.error('[unsubscribe] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = unsubscribe;