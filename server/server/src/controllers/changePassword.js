require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const User = require('../models/User');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;


    // 1️⃣ Get username from authenticated user (set by middleware)
    const username = req.user.username; // assumes token has 'username' field
    if (!username) {
      return res.status(400).json({ error: 'Username not found in token' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    // 2️⃣ Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 3️⃣ Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // 4️⃣ Update password – plain text, pre‑save hook will hash it
    user.password = newPassword;
    await user.save();

    console.log(`[Change Password] Password changed for user: ${user.username} (${user.email})`);
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('[Change Password] Error:', error);
    res.status(500).json({ error: 'Failed to change password. Please try again later.' });
  }
};