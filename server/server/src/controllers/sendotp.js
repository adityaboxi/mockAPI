const { redisClient } = require('../config/redis');
const { emailQueue } = require('../queues/emailQueue');

async function sendotp(username, email, password, name) {
  console.log("=== SENDOTP FUNCTION CALLED ===");
  console.log("Username:", username);
  console.log("Email:", email);
  console.log("Name:", name);
  
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `${username}_${email}`;
  const otptime = parseInt(process.env.OTP_VALIDATION_TIME);
  
  console.log("Generated OTP:", otp);
  console.log("Redis key:", key);
  console.log("OTP TTL (seconds):", otptime);

  await redisClient.setEx(key, otptime, otp);
  console.log("✅ OTP stored in Redis");

  console.log("🚚 Offloading email task to BullMQ...");
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
  
  console.log("✅ Email task successfully queued.");
  console.log(`📝 OTP for ${email}: ${otp}`);
  
  return { success: true, message: 'OTP generation requested successfully' };
}

module.exports = { sendotp };