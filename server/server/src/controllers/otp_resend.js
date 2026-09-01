require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { connectRedis } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');

async function otp_resend(req, res) {
  const { email, username } = req.body;

  if (!email || !username) {
    return res.status(400).json({ message: 'Email and username are required' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const client = await connectRedis();
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${normalizedUsername}_${normalizedEmail}`;
    const otpTime = parseInt(process.env.OTP_VALIDATION_TIME, 10) || 300;

    await client.setEx(key, otpTime, generatedOtp);

    await emailQueue.add(
      'sendOTP',
      {
        email: normalizedEmail,
        otp: generatedOtp,
        username: normalizedUsername,
      },
      {
        attempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10) || 3,
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.EMAIL_RETRY_BACKOFF_DELAY, 10) || 5000,
        },
      }
    );

    return res.json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    console.error('otp_resend error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = otp_resend;