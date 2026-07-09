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

    console.log('🔑 Attempting to store OTP with key:', key);
    console.log('📦 Redis client isOpen:', redisClient.isOpen);
    
    const setResult = await redisClient.setEx(key, otptime, generatedOtp);
    console.log('✅ Redis setEx result:', setResult);

    console.log('🚚 Offloading resend OTP email task to BullMQ...');
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

    console.log(`✅ Resend OTP job successfully queued for ${email}`);
    
    res.json({ success: true, message: 'OTP resent successfully' });

  } catch (error) {
    console.error('❌ otp_resend error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = otp_resend;