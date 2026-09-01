require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const username = req.user?.username;

    if (!username) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('[Change Password] Error:', error.message);
    return res.status(500).json({ error: 'Failed to change password. Please try again later.' });
  }
};