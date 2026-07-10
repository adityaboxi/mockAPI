const User = require('../models/User');

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

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled',
      subscribe: false
    });
  } catch (error) {
    console.error('Unsubscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = unsubscribe;


/*
const User = require('../models/User');
const { internalRedis } = require('../config/redis');

async function unsubscribe(req, res) {
  const { username } = req.user; // guaranteed by auth middleware

  try {
    // Check if user exists and is subscribed
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.subscribe) {
      return res.status(400).json({ error: 'Not subscribed' });
    }

    // Update subscription status
    user.subscribe = false;
    await user.save();

    // Invalidate user cache (so any cached data that depends on subscription status is refreshed)
    const cachePattern = `cache:${username}:*`;
    try {
      const keys = await internalRedis.keys(cachePattern);
      if (keys.length) {
        await internalRedis.del(keys);
      }
    } catch (err) {
      // Redis error – ignore
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled',
      subscribe: false
    });
  } catch (error) {
    console.error('[unsubscribe] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = unsubscribe;*/