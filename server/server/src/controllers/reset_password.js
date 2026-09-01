require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'jwt_default_secret_key';
    let decoded;
    try {
      decoded = jwt.verify(resetToken, jwtSecret);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired reset token. Please request a new OTP.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('[Reset Password] Error:', error.message);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
};