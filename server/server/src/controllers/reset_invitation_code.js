require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const crypto = require('crypto');
const Project = require('../models/Project');
const { redisClient } = require('../config/redis');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Read configuration from environment with reliable fallbacks
const INVITATION_CHARSET = process.env.INVITATION_CHARSET || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INVITATION_CODE_LENGTH = parseInt(process.env.INVITATION_CODE_LENGTH, 10) || 8;
const RESET_INVITE_OTP_TTL = parseInt(process.env.RESET_INVITE_OTP_TTL, 10) || 120;
const FROM_EMAIL = process.env.FROM_EMAIL || 'krishnaboxi1983@gmail.com';

// Google SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: parseInt(process.env.SMTP_PORT, 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.GOOGLE_SMTP,
  },
});

async function reset_invitation_code(req, res) {
  const username = req.user?.username;
  const { project_id } = req.body;

  if (!project_id) {
    return res.status(400).json({ error: 'Project ID is required' });
  }
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.username !== username) {
      return res.status(403).json({ error: 'Only the project creator can reset the invitation code' });
    }

    // Generate new random invitation code
    let newCode = '';
    for (let i = 0; i < INVITATION_CODE_LENGTH; i++) {
      newCode += INVITATION_CHARSET.charAt(Math.floor(Math.random() * INVITATION_CHARSET.length));
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `reset_invite:${project_id}:${username}`;
    const pendingCodeKey = `pending_invite:${project_id}:${username}`;

    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.setEx(otpKey, RESET_INVITE_OTP_TTL, otp);
        await redisClient.setEx(pendingCodeKey, RESET_INVITE_OTP_TTL, newCode);
      }
    } catch (redisErr) {
      console.warn('[reset-invitation-code] Redis setEx warning:', redisErr.message);
    }

    // Send OTP email
    let emailSent = false;
    try {
      const user = await User.findOne({ username });
      if (user?.email && FROM_EMAIL) {
        await transporter.sendMail({
          from: FROM_EMAIL,
          to: user.email,
          subject: `Reset Invitation Code for ${project.projectname}`,
          text: `Your OTP to reset the invitation code is: ${otp}\n\nValid for ${RESET_INVITE_OTP_TTL} seconds.`,
          html: `<div><h2>Reset Invitation Code</h2><p>Your OTP: <strong>${otp}</strong></p><p>Valid for ${RESET_INVITE_OTP_TTL} seconds.</p></div>`,
        });
        emailSent = true;
      }
    } catch (emailError) {
      console.error('[reset-invitation-code] Email error:', emailError.message);
    }

    const responseData = {
      success: true,
      message: emailSent ? 'OTP sent to your email' : 'OTP generated (email delivery may have failed)',
    };
    if (process.env.NODE_ENV === 'development') {
      responseData.testOtp = otp;
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('[reset-invitation-code] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = reset_invitation_code;