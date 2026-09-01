require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { connectRedis } = require('../config/redis');

module.exports = async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Identifier and OTP are required' });
    }

    const trimmedId = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: trimmedId },
        { email: trimmedId },
      ],
    }).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const client = await connectRedis();
    const key = `reset:otp:${user._id.toString()}`;
    const storedOtp = await client.get(key);

    if (!storedOtp) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (storedOtp !== otp.toString().trim()) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'jwt_default_secret_key';
    const resetToken = jwt.sign(
      { userId: user._id },
      jwtSecret,
      { expiresIn: '10m' }
    );

    await client.del(key);

    return res.status(200).json({
      message: 'OTP verified successfully. You can now reset your password.',
      resetToken,
    });
  } catch (error) {
    console.error('[Verify Forgot OTP] Error:', error.message);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
};