require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { redisClient } = require('../config/redis');

// Read TTL from environment with default 7 days fallback
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

    const otpKey = `reset_invite:${project_id}:${username}`;
    let storedOtp = null;
    let newInvitationCode = null;

    if (redisClient && redisClient.isOpen) {
      storedOtp = await redisClient.get(otpKey);
      const pendingCodeKey = `pending_invite:${project_id}:${username}`;
      newInvitationCode = await redisClient.get(pendingCodeKey);
    }

    if (!storedOtp || storedOtp !== String(otp).trim()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (!newInvitationCode) {
      return res.status(400).json({ error: 'Pending invitation code expired or not found. Please request a new OTP.' });
    }

    const oldCode = project.invitationCode;
    project.invitationCode = newInvitationCode;
    await project.save();

    // Update ProjectApiHistory
    const projectHistory = await ProjectApiHistory.findOne({
      $or: [
        { projectID: project.id },
        { projectID: project._id ? project._id.toString() : null },
        { projectCode: oldCode },
      ].filter(Boolean),
    });

    if (projectHistory) {
      projectHistory.projectCode = newInvitationCode;
      await projectHistory.save();
    }

    // Update Redis invitation key
    try {
      if (redisClient && redisClient.isOpen) {
        if (oldCode) await redisClient.del(`invitation:${oldCode}`);
        await redisClient.setEx(`invitation:${newInvitationCode}`, INVITATION_REDIS_TTL, project._id.toString());
        await redisClient.del(otpKey);
        await redisClient.del(`pending_invite:${project_id}:${username}`);
        await redisClient.del(`user:projects:${username}`);
      }
    } catch (_) {}

    if (req.io) {
      req.io.to(project.id).emit('invitation_code_updated', {
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
    console.error('[verify-invitationcode-otp] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = verify_invitationcode_otp;