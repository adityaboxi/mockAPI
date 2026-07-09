const crypto = require('crypto');
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
  console.log('\n==========================================');
  console.log('[reset-invitation-code] 🟢 REQUEST RECEIVED');
  console.log('==========================================');
  
  const username = req.user?.username;
  const { project_id, projectName } = req.body;

  console.log(`📋 Project ID: ${project_id}`);
  console.log(`📦 Project Name: ${projectName || 'N/A'}`);
  console.log(`👤 Username (from token): ${username}`);
  console.log('==========================================\n');

  if (!project_id) {
    console.error('[reset-invitation-code] ❌ Missing project_id');
    return res.status(400).json({ error: 'Project ID is required' });
  }
  if (!username) {
    console.error('[reset-invitation-code] ❌ No authenticated user found');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    console.log(`[reset-invitation-code] 🔍 Searching for project with ID: ${project_id}`);
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      console.error(`[reset-invitation-code] ❌ Project not found: ${project_id}`);
      return res.status(404).json({ error: 'Project not found' });
    }
    console.log(`[reset-invitation-code] ✅ Project found: ${project.projectname}`);
    console.log(`   - Creator: ${project.username}`);
    console.log(`   - Current Code: ${project.invitationCode}`);

    if (project.username !== username) {
      console.error(`[reset-invitation-code] ❌ Permission denied: ${username} is not the creator`);
      return res.status(403).json({ error: 'Only the project creator can reset the invitation code' });
    }
    console.log(`[reset-invitation-code] ✅ User ${username} verified as project creator`);

    // Generate new invitation code using env variables
    let newCode = '';
    for (let i = 0; i < INVITATION_CODE_LENGTH; i++) {
      newCode += INVITATION_CHARSET.charAt(Math.floor(Math.random() * INVITATION_CHARSET.length));
    }
    console.log(`[reset-invitation-code] 🔑 Generated new invitation code: ${newCode}`);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `reset_invite:${project_id}:${username}`;
    await redisClient.setEx(otpKey, RESET_INVITE_OTP_TTL, otp);
    console.log(`[reset-invitation-code] 📱 OTP generated: ${otp} (expires in ${RESET_INVITE_OTP_TTL} sec)`);
    console.log(`[reset-invitation-code] 💾 OTP stored in Redis (key: ${otpKey})`);

    // Store pending code
    const pendingCodeKey = `pending_invite:${project_id}:${username}`;
    await redisClient.setEx(pendingCodeKey, RESET_INVITE_OTP_TTL, newCode);
    console.log(`[reset-invitation-code] 💾 Pending code stored (key: ${pendingCodeKey})`);

    // Send OTP email
    let emailSent = false;
    try {
      const User = require('../models/User');
      const user = await User.findOne({ username });
      if (user && user.email) {
        console.log(`[reset-invitation-code] 📧 Found email: ${user.email}`);
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
          console.log(`[reset-invitation-code] ✅ Email sent to ${user.email}`);
        } else {
          console.warn(`[reset-invitation-code] ⚠️ Email not sent - SendGrid not configured`);
        }
      } else {
        console.warn(`[reset-invitation-code] ⚠️ No email found for user: ${username}`);
      }
    } catch (emailError) {
      console.error(`[reset-invitation-code] ❌ Email error:`, emailError.message);
    }

    console.log('\n==========================================');
    console.log('[reset-invitation-code] 🟢 REQUEST COMPLETED SUCCESSFULLY');
    console.log(`   - OTP: ${otp} (expires in ${RESET_INVITE_OTP_TTL}s)`);
    console.log(`   - New Code: ${newCode} (pending verification)`);
    console.log(`   - Email sent: ${emailSent ? 'YES ✅' : 'NO ⚠️'}`);
    console.log('==========================================\n');

    const responseData = {
      success: true,
      message: emailSent ? 'OTP sent to your email' : 'OTP generated (email delivery may have failed)'
    };
    if (process.env.NODE_ENV === 'development') {
      responseData.testOtp = otp;
      console.log(`[reset-invitation-code] 🧪 DEV MODE - Test OTP: ${otp}`);
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