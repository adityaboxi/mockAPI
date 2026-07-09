const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { redisClient } = require('../config/redis');

// Read TTL from environment (no fallback)
const INVITATION_REDIS_TTL = parseInt(process.env.INVITATION_REDIS_TTL, 10);

async function verify_invitationcode_otp(req, res) {
  const username = req.user?.username;
  const { project_id, otp } = req.body;

  if (!project_id || !otp) {
    return res.status(400).json({ error: 'Project ID and OTP are required' });
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

    const otpKey = `reset_invite:${project_id}:${username}`;
    const storedOtp = await redisClient.get(otpKey);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const pendingCodeKey = `pending_invite:${project_id}:${username}`;
    const newInvitationCode = await redisClient.get(pendingCodeKey);
    if (!newInvitationCode) {
      return res.status(400).json({ error: 'Pending invitation code not found' });
    }

    const oldCode = project.invitationCode;
    project.invitationCode = newInvitationCode;
    await project.save();

    // Update ProjectApiHistory
    const projectHistory = await ProjectApiHistory.findOne({ projectCode: oldCode });
    if (projectHistory) {
      projectHistory.projectCode = newInvitationCode;
      await projectHistory.save();
    }

    // Update Redis invitation key with configurable TTL
    await redisClient.setEx(`invitation:${newInvitationCode}`, INVITATION_REDIS_TTL, project._id.toString());
    await redisClient.del(otpKey);
    await redisClient.del(pendingCodeKey);

    res.status(200).json({
      success: true,
      message: 'Invitation code reset successfully',
      newInvitationCode
    });
  } catch (error) {
    console.error('Verify invitation code OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = verify_invitationcode_otp;