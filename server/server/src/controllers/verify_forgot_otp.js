const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');

module.exports = async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Identifier and OTP are required' });
    }

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const key = `reset:otp:${user._id.toString()}`;
    const storedOtp = await redisClient.get(key);

    if (!storedOtp) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Generate reset token (valid 5 minutes)
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    // Delete the OTP from Redis so it cannot be reused
    await redisClient.del(key);

    res.status(200).json({
      message: 'OTP verified successfully. You can now reset your password.',
      resetToken,
    });

  } catch (error) {
    console.error('[Verify Forgot OTP] Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};