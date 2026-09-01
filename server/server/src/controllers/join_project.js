// server/controllers/join_project.js
require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const Project = require('../models/Project');
const RequestJoinProject = require('../models/RequestJoinProject');
const { redisClient } = require('../config/redis');

async function join_project(req, res) {
  const { joinCode } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(403).json({ error: 'Guest sessions cannot request workspace access. Please sign in.' });
  }

  if (!joinCode || typeof joinCode !== 'string' || !joinCode.trim()) {
    return res.status(400).json({ error: 'Valid join code is required' });
  }

  try {
    const normalizedCode = String(joinCode).trim().toUpperCase();

    const project = await Project.findOne({ invitationCode: normalizedCode, isActive: true }).lean();
    if (!project) {
      return res.status(404).json({ error: 'Invalid or inactive workspace invitation code' });
    }

    if (project.username === username) {
      return res.status(400).json({ error: 'You are already the owner of this workspace' });
    }

    if (project.members && Array.isArray(project.members) && project.members.includes(username)) {
      return res.status(400).json({ error: 'You are already a member of this workspace' });
    }

    const maxMembers = project.issubdcribe ? 2 : 1;
    const currentMembers = project.noofmemebers || (project.members ? project.members.length : 1);
    if (currentMembers >= maxMembers) {
      return res.status(400).json({
        error: `Workspace limit reached (${maxMembers} member maximum). Upgrade subscription to invite additional members.`,
      });
    }

    // Check for existing pending request
    const existingReq = await RequestJoinProject.findOne({
      invitationCode: project.invitationCode,
      requestuser: username,
    }).lean();

    if (existingReq) {
      return res.status(409).json({ error: 'A pending join request is already awaiting workspace owner review.' });
    }

    let createdRequest;
    try {
      createdRequest = await RequestJoinProject.create({
        invitationCode: project.invitationCode,
        requestuser: username,
        responseuser: project.username,
        isreqaccepted: false,
      });
    } catch (dbError) {
      if (dbError.code === 11000) {
        return res.status(409).json({ error: 'A pending join request already exists' });
      }
      throw dbError;
    }

    const notificationPayload = {
      id: createdRequest._id.toString(),
      requestuser: username,
      projectname: project.projectname,
      projectId: project.id,
      invitationCode: project.invitationCode,
      timestamp: new Date().toISOString(),
    };

    // Emit real-time notification
    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.publish(
          'user_notification',
          JSON.stringify({
            room: `user_${project.username}`,
            event: 'incoming_join_request',
            data: notificationPayload,
          })
        );
      }
    } catch (_) {}

    if (req.io) {
      req.io.to(`user_${project.username}`).emit('incoming_join_request', notificationPayload);
    }

    return res.status(200).json({
      success: true,
      message: 'Join request successfully sent to workspace manager for review.',
      requestId: createdRequest._id.toString(),
    });
  } catch (error) {
    console.error('[join-project] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = join_project;