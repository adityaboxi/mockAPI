require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const { redisClient } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');

async function otp_resend(req, res) {
  const { email, username } = req.body;

  if (!email || !username) {
    return res.status(400).json({ message: 'Email and username are required' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const key = `${cleanUsername}_${cleanEmail}`;

  try {
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpTime = parseInt(process.env.OTP_VALIDATION_TIME, 10) || 600;

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(key, otpTime, generatedOtp);
    }

    try {
      await emailQueue.add(
        'sendOTP',
        {
          email: cleanEmail,
          otp: generatedOtp,
          username: cleanUsername,
        },
        {
          attempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10) || 3,
          backoff: {
            type: 'exponential',
            delay: parseInt(process.env.EMAIL_RETRY_BACKOFF_DELAY, 10) || 5000,
          },
        }
      );
    } catch (queueErr) {
      console.warn('[otp_resend] Email queue warning:', queueErr.message);
    }

    const responsePayload = {
      success: true,
      message: 'Verification code resent successfully to your email',
    };
    if (process.env.NODE_ENV === 'development') {
      responsePayload.testOtp = generatedOtp;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('[otp_resend] Error:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = otp_resend;