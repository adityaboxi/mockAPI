require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { redisClient } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');
async function otp_resend(req, res) {
const { email, username } = req.body;
if (!email || !username) {
return res.status(400).json({ message: 'Email and username are required' });
  }
try {
const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
const key = `${username}_${email}`;
const otptime = parseInt(process.env.OTP_VALIDATION_TIME);
const setResult = await redisClient.setEx(key, otptime, generatedOtp);
await emailQueue.add('sendOTP', {
      email: email,
      otp: generatedOtp,
      username: username
    }, {
      attempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.EMAIL_RETRY_BACKOFF_DELAY, 10)
      }
    });
    res.json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    console.error('❌ otp_resend error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
module.exports = otp_resend;

/*
const { redisClient } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');

async function otp_resend(req, res) {
  const { email, username } = req.body;

  if (!email || !username) {
    return res.status(400).json({ error: 'Email and username are required' });
  }

  try {
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${username}_${email}`;
    const otpTime = parseInt(process.env.OTP_VALIDATION_TIME, 10) || 120;

    await redisClient.setEx(key, otpTime, generatedOtp);

    await emailQueue.add('sendOTP', {
      email,
      otp: generatedOtp,
      username
    }, {
      attempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10) || 3,
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.EMAIL_RETRY_BACKOFF_DELAY, 10) || 5000
      }
    });

    return res.json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    console.error('[otp-resend] Error:', error);
    return res.status(500).json({ error: 'Failed to resend OTP' });
  }
}

module.exports = otp_resend;*/