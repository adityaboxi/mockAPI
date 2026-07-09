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

    console.log(`✅ Subscription cancelled for user: ${user.username}`);
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