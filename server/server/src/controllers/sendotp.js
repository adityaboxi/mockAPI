require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { connectRedis } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');

async function sendotp(username, email, password, name) {
  if (!username || !email) {
    throw new Error('Username and email are required');
  }

  const client = await connectRedis();
  const key = `${username}_${email}`;

  const existingOtp = await client.get(key);
  if (existingOtp) {
    return { success: true, message: 'OTP already sent, please check your email' };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpTime = parseInt(process.env.OTP_VALIDATION_TIME, 10) || 300;
  const retryAttempts = parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10) || 3;
  const backoffDelay = parseInt(process.env.EMAIL_RETRY_BACKOFF_DELAY, 10) || 5000;

  try {
    await client.setEx(key, otpTime, otp);

    await emailQueue.add(
      'sendOTP',
      {
        email,
        otp,
        username,
        name,
      },
      {
        attempts: retryAttempts,
        backoff: {
          type: 'exponential',
          delay: backoffDelay,
        },
      }
    );

    return { success: true, message: 'OTP generation requested successfully' };
  } catch (error) {
    console.error('[sendotp] Error:', error.message);
    throw new Error('Failed to generate or send OTP');
  }
}

module.exports = { sendotp };