
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST
require('dotenv').config();

const nodemailer = require('nodemailer');

// Read environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
const SMTP_USER = process.env.SMTP_USER || process.env.FROM_EMAIL;
const SMTP_PASS = process.env.GOOGLE_SMTP;
const FROM_EMAIL = process.env.FROM_EMAIL;

// Create transporter with connection pooling for high-throughput concurrency
const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function sendOTPEmail(email, otp, username) {
  const expirationTime = process.env.OTP_VALIDATION_TIME || '300';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#0f0f1a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
          <div style="background:linear-gradient(145deg, #1a1a2e, #16213e);border-radius:24px;padding:40px 32px;box-shadow:0 20px 60px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.06);">
            <div style="text-align:center;margin-bottom:30px;">
              <span style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);padding:6px 20px;border-radius:40px;font-size:14px;font-weight:700;color:#fff;letter-spacing:0.5px;text-transform:uppercase;">MockAPI</span>
            </div>
            <h2 style="font-size:24px;font-weight:600;color:#e0e0ff;margin:0 0 8px 0;text-align:center;letter-spacing:-0.3px;">Verify Your Email</h2>
            <p style="color:#9ba3c4;font-size:16px;line-height:1.6;text-align:center;margin:0 0 28px 0;">
              Hi <strong style="color:#c8d0f0;">${username}</strong>,<br>
              use the one-time password below to complete your sign-in.
            </p>
            <div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:24px 16px;margin-bottom:32px;border:1px solid rgba(102,126,234,0.25);text-align:center;">
              <div style="font-size:44px;font-weight:700;letter-spacing:6px;color:#a78bfa;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;text-shadow:0 0 20px rgba(102,126,234,0.3);">
                ${otp}
              </div>
            </div>
            <p style="color:#7a85a8;font-size:14px;line-height:1.5;text-align:center;margin:0 0 6px 0;">
              ⏱️ This code expires in <strong style="color:#b7c0e0;">${expirationTime} seconds</strong>.
            </p>
            <p style="color:#555e7a;font-size:13px;line-height:1.5;text-align:center;margin:0 0 24px 0;">
              If you didn't request this, you can safely ignore this email.
            </p>
            <div style="border-top:1px solid rgba(255,255,255,0.06);margin:24px 0 16px 0;"></div>
            <p style="color:#3f4666;font-size:12px;text-align:center;margin:0;">
              &copy; ${new Date().getFullYear()} MockAPI · Secured with ❤️
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `Your OTP code is: ${otp}. It is valid for ${expirationTime} seconds.\n\nHello ${username},\n\nUse this code to verify your email on MockAPI.\n\nIf you didn't request this, please ignore this email.\n\n— MockAPI Team`;

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your OTP Verification Code from MockAPI',
      text: textContent,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error('[email-service] Error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOTPEmail };

