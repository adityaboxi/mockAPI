const { redisClient } = require('../config/redis');
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

module.exports = { sendotp };