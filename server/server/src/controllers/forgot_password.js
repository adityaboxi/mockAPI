require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const User = require('../models/User');
const { sendOTPEmail } = require('../services/emailService');
const { redisClient } = require('../config/redis');
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
        { username: trimmedId },
        { email: trimmedId.toLowerCase() }
      ]
    });

    // Generic response (no user enumeration)
    if (!user) {
      return res.status(200).json({
        message: 'If an account with that username or email exists, an OTP has been sent.'
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    // Store OTP in Redis with TTL from env (default 600s)
    const ttl = parseInt(process.env.OTP_VALIDATION_TIME, 10) || 600;
    const key = `reset:otp:${user._id.toString()}`;
    await redisClient.set(key, otp, { EX: ttl });

    const result = await sendOTPEmail(user.email, otp, user.username);

    if (!result.success) {
      console.error('[Forgot Password] Email send failed:', result.error);
      // Still generic
    }

    res.status(200).json({
      message: 'If an account with that username or email exists, an OTP has been sent.'
    });

  } catch (error) {
    console.error('[Forgot Password] Error:', error);
    res.status(500).json({ error: 'Failed to send OTP. Please try again later.' });
  }
};