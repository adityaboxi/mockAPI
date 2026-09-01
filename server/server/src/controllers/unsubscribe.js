require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { connectRedis } = require('../config/redis');

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
      return res.status(400).json({ error: 'Not subscribed' });
    }

    user.subscribe = false;
    await user.save();

    try {
      const client = await connectRedis();
      await client.del(`user:projects:${username}`);
      await client.del(`user_profile:${user._id}`);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled',
      subscribe: false,
    });
  } catch (error) {
    console.error('Unsubscription error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = unsubscribe;