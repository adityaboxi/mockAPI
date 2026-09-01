/*const crypto = require('crypto');
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { redisClient } = require('../config/redis');
let sgMail = null;
try {
  sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
} catch (error) {
  console.warn('[reset-invitation-code] SendGrid not available');
}
// Read configuration from environment (no fallbacks)
const INVITATION_CHARSET = process.env.INVITATION_CHARSET;
const INVITATION_CODE_LENGTH = parseInt(process.env.INVITATION_CODE_LENGTH, 10);
const RESET_INVITE_OTP_TTL = parseInt(process.env.RESET_INVITE_OTP_TTL, 10);
async function reset_invitation_code(req, res) {
const username = req.user?.username;
const { project_id, projectName } = req.body;
if (!project_id) {
    console.error('[reset-invitation-code] ❌ Missing project_id');
return res.status(400).json({ error: 'Project ID is required' });
  }
if (!username) {
    console.error('[reset-invitation-code] ❌ No authenticated user found');
return res.status(401).json({ error: 'Authentication required' });
  }
try {
const project = await Project.findOne({ id: project_id });
if (!project) {
      console.error(`[reset-invitation-code] ❌ Project not found: ${project_id}`);
return res.status(404).json({ error: 'Project not found' });
    }
if (project.username !== username) {
      console.error(`[reset-invitation-code] ❌ Permission denied: ${username} is not the creator`);
return res.status(403).json({ error: 'Only the project creator can reset the invitation code' });
    }
// Generate new invitation code using env variables
let newCode = '';
for (let i = 0; i < INVITATION_CODE_LENGTH; i++) {
      newCode += INVITATION_CHARSET.charAt(Math.floor(Math.random() * INVITATION_CHARSET.length));
    }
// Generate OTP
const otp = Math.floor(100000 + Math.random() * 900000).toString();
const otpKey = `reset_invite:${project_id}:${username}`;
await redisClient.setEx(otpKey, RESET_INVITE_OTP_TTL, otp);
// Store pending code
const pendingCodeKey = `pending_invite:${project_id}:${username}`;
await redisClient.setEx(pendingCodeKey, RESET_INVITE_OTP_TTL, newCode);
// Send OTP email
let emailSent = false;
try {
const User = require('../models/User');
const user = await User.findOne({ username });
if (user && user.email) {
if (sgMail && process.env.SENDGRID_API_KEY && process.env.FROM_EMAIL) {
const msg = {
            to: user.email,
            from: process.env.FROM_EMAIL,
            subject: `Reset Invitation Code for ${project.projectname}`,
            text: `Your OTP to reset the invitation code is: ${otp}\n\nValid for ${RESET_INVITE_OTP_TTL} seconds.\n\nIf you did not request this, please ignore this email.`,
            html: `<div><h2>Reset Invitation Code</h2><p>Your OTP: <strong>${otp}</strong></p><p>Valid for ${RESET_INVITE_OTP_TTL} seconds.</p></div>`
          };
await sgMail.send(msg);
          emailSent = true;
        } else {
          console.warn(`[reset-invitation-code] ⚠️ Email not sent - SendGrid not configured`);
        }
      } else {
        console.warn(`[reset-invitation-code] ⚠️ No email found for user: ${username}`);
      }
    } catch (emailError) {
      console.error(`[reset-invitation-code] ❌ Email error:`, emailError.message);
    }
const responseData = {
      success: true,
      message: emailSent ? 'OTP sent to your email' : 'OTP generated (email delivery may have failed)'
    };
if (process.env.NODE_ENV === 'development') {
      responseData.testOtp = otp;
    }
    res.status(200).json(responseData);
  } catch (error) {
    console.error('\n==========================================');
    console.error('[reset-invitation-code] 🔴 ERROR OCCURRED');
    console.error(`   - Error message: ${error.message}`);
    console.error(`   - Error stack: ${error.stack}`);
    console.error('==========================================\n');
    res.status(500).json({ error: 'Internal server error' });
  }
}
module.exports = reset_invitation_code;
*/


require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const crypto = require('crypto');
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { redisClient } = require('../config/redis');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Read configuration from environment
const INVITATION_CHARSET = process.env.INVITATION_CHARSET;
const INVITATION_CODE_LENGTH = parseInt(process.env.INVITATION_CODE_LENGTH, 10);
const RESET_INVITE_OTP_TTL = parseInt(process.env.RESET_INVITE_OTP_TTL, 10);
const FROM_EMAIL = process.env.FROM_EMAIL;

// Google SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: parseInt(process.env.SMTP_PORT, 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.GOOGLE_SMTP, // app password
  },
});

async function reset_invitation_code(req, res) {
  const username = req.user.username; // guaranteed by auth middleware
  const { project_id } = req.body;

  if (!project_id) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  try {
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.username !== username) {
      return res.status(403).json({ error: 'Only the project creator can reset the invitation code' });
    }

    // Generate new invitation code
    let newCode = '';
    for (let i = 0; i < INVITATION_CODE_LENGTH; i++) {
      newCode += INVITATION_CHARSET.charAt(Math.floor(Math.random() * INVITATION_CHARSET.length));
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `reset_invite:${project_id}:${username}`;
    await redisClient.setEx(otpKey, RESET_INVITE_OTP_TTL, otp);

    // Store pending code
    const pendingCodeKey = `pending_invite:${project_id}:${username}`;
    await redisClient.setEx(pendingCodeKey, RESET_INVITE_OTP_TTL, newCode);

    // ---- Invalidate cache for this user ----
    const cachePattern = `cache:${username}:*`;
    try {
      const keys = await redisClient.keys(cachePattern);
      if (keys.length) {
        await redisClient.del(keys);
      }
    } catch (err) {
      // Redis error – ignore
    }

    // ---- Send OTP email via Google SMTP ----
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
    console.error('[reset-invitation-code] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = reset_invitation_code;