require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { connectRedis } = require('../config/redis');

async function subscribe(req, res) {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await User.findOneAndUpdate(
      { username, subscribe: false },
      { $set: { subscribe: true, subscriptionUpdatedAt: new Date() } },
      { new: true, projection: { password: 0, __v: 0 } }
    );

    if (!user) {
      const existingUser = await User.findOne({ username }).select('subscribe');
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (existingUser.subscribe === true) {
        return res.status(200).json({
          success: true,
          message: 'Already subscribed',
          subscribe: true,
        });
      }
      return res.status(400).json({ error: 'Unable to process subscription' });
    }

    try {
      const client = await connectRedis();
      await client.del(`user:projects:${username}`);
      await client.del(`user_profile:${user._id}`);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Subscription activated',
      subscribe: true,
      user: { id: user._id, username: user.username, subscribe: user.subscribe },
    });
  } catch (error) {
    console.error('Subscription error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = subscribe;