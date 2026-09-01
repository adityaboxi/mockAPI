require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const { sendOTPEmail } = require('../services/emailService');
const { connectRedis } = require('../config/redis');
const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Username or email is required' });
    }

    const trimmedId = identifier.trim();
    if (trimmedId.length === 0) {
      return res.status(400).json({ error: 'Username or email cannot be empty' });
    }

    const user = await User.findOne({
      $or: [
        { username: trimmedId.toLowerCase() },
        { email: trimmedId.toLowerCase() },
      ],
    }).lean();

    if (!user) {
      return res.status(200).json({
        message: 'If an account with that username or email exists, an OTP has been sent.',
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const ttl = parseInt(process.env.OTP_VALIDATION_TIME, 10) || 600;
    const key = `reset:otp:${user._id.toString()}`;

    const client = await connectRedis();
    await client.setEx(key, ttl, otp);

    const result = await sendOTPEmail(user.email, otp, user.username);
    if (!result.success) {
      console.error('[Forgot Password] Email send failed:', result.error);
    }

    return res.status(200).json({
      message: 'If an account with that username or email exists, an OTP has been sent.',
    });
  } catch (error) {
    console.error('[Forgot Password] Error:', error.message);
    return res.status(500).json({ error: 'Failed to send OTP. Please try again later.' });
  }
};