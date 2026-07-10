/*const { redisClient } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');

async function sendotp(username, email, password, name) {

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `${username}_${email}`;
  const otptime = parseInt(process.env.OTP_VALIDATION_TIME);
  

  await redisClient.setEx(key, otptime, otp);
await emailQueue.add('sendOTP', {
    email: email,
    otp: otp,
    username: username
  }, {
    attempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10),
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.EMAIL_RETRY_BACKOFF_DELAY, 10)
    }
  });
  
  
  return { success: true, message: 'OTP generation requested successfully' };
}

module.exports = { sendotp };*/




const { redisClient } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');

async function sendotp(username, email, password, name) {
  // Validate required inputs
  if (!username || !email) {
    throw new Error('Username and email are required');
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `${username}_${email}`;
  const otpTime = parseInt(process.env.OTP_VALIDATION_TIME, 10) || 120;
  const retryAttempts = parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10) || 3;
  const backoffDelay = parseInt(process.env.EMAIL_RETRY_BACKOFF_DELAY, 10) || 5000;

  try {
    // Store OTP in Redis
    await redisClient.setEx(key, otpTime, otp);

    // Queue email
    await emailQueue.add('sendOTP', {
      email,
      otp,
      username
    }, {
      attempts: retryAttempts,
      backoff: {
        type: 'exponential',
        delay: backoffDelay
      }
    });

    return { success: true, message: 'OTP generation requested successfully' };
  } catch (error) {
    console.error('[sendotp] Error:', error);
    throw new Error('Failed to generate or send OTP');
  }
}

module.exports = { sendotp };