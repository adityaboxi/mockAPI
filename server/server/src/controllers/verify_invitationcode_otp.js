require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { connectRedis } = require('../config/redis');

// Default TTL to 7 days if env var is missing
const INVITATION_REDIS_TTL = parseInt(process.env.INVITATION_REDIS_TTL, 10) || 604800;

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

    const client = await connectRedis();
    const otpKey = `reset_invite:${project_id}:${username}`;
    const storedOtp = await client.get(otpKey);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const pendingCodeKey = `pending_invite:${project_id}:${username}`;
    const newInvitationCode = await client.get(pendingCodeKey);
    if (!newInvitationCode) {
      return res.status(400).json({ error: 'Pending invitation code not found' });
    }

    const oldCode = project.invitationCode;
    project.invitationCode = newInvitationCode;
    await project.save();

    // Update ProjectApiHistory
    await ProjectApiHistory.updateMany(
      { $or: [{ projectID: project.id }, { projectCode: oldCode }] },
      { $set: { projectCode: newInvitationCode } }
    );

    // Update Redis invitation key
    await client.setEx(`invitation:${newInvitationCode}`, INVITATION_REDIS_TTL, project.id);
    await client.del(`invitation:${oldCode}`);
    await client.del(otpKey);
    await client.del(pendingCodeKey);
    await client.del(`user:projects:${username}`);

    if (req.io) {
      req.io.to(project.id).emit('invitation_code_updated', {
        projectId: project.id,
        invitationCode: newInvitationCode,
      });
      req.io.to(`user_${username}`).emit('invitation_code_updated', {
        projectId: project.id,
        invitationCode: newInvitationCode,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation code reset successfully',
      newInvitationCode,
    });
  } catch (error) {
    console.error('Verify invitation code OTP error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = verify_invitationcode_otp;