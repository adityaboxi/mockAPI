require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');
const Project = require('../models/Project');
const RequestJoinProject = require('../models/RequestJoinProject');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { connectRedis } = require('../config/redis');

async function approve_project_request(req, res) {
  const { requestId } = req.params;
  const managerUsername = req.user?.username;

  if (!managerUsername) return res.status(401).json({ error: 'Unauthorized' });

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({ error: 'Invalid request ID format' });
  }

  try {
    const joinRequest = await RequestJoinProject.findOneAndUpdate(
      { _id: requestId, responseuser: managerUsername, isreqaccepted: false },
      { $set: { isreqaccepted: true } },
      { new: true }
    );
    if (!joinRequest) {
      return res.status(400).json({ error: 'Join request not found, unauthorized, or already processed' });
    }

    const project = await Project.findOne({ invitationCode: joinRequest.invitationCode, isActive: true });
    if (!project) {
      // Revert if project missing
      await RequestJoinProject.updateOne({ _id: requestId }, { $set: { isreqaccepted: false } });
      return res.status(404).json({ error: 'Workspace is no longer active or missing' });
    }

    const maxMembers = project.issubdcribe ? 2 : 1;
    const currentMembers = project.members ? project.members.length : (project.noofmemebers || 1);
    if (currentMembers >= maxMembers && !project.members.includes(joinRequest.requestuser)) {
      await RequestJoinProject.updateOne({ _id: requestId }, { $set: { isreqaccepted: false } });
      return res.status(400).json({
        error: `Project has reached the maximum of ${maxMembers} member(s). Cannot accept more join requests.`,
      });
    }

    const updatedProject = await Project.findOneAndUpdate(
      {
        _id: project._id,
        $expr: {
          $lt: [{ $size: { $ifNull: ['$members', []] } }, maxMembers]
        }
      },
      {
        $addToSet: { members: joinRequest.requestuser },
        $set: { noofmemebers: Math.min(maxMembers, currentMembers + 1) }
      },
      { new: true }
    );

    if (!updatedProject) {
      await RequestJoinProject.updateOne({ _id: requestId }, { $set: { isreqaccepted: false } });
      return res.status(400).json({
        error: `Project has reached the maximum of ${maxMembers} member(s). Cannot accept more join requests.`,
      });
    }

    await ProjectApiHistory.updateOne(
      { $or: [{ projectID: project.id }, { projectCode: project.invitationCode }] },
      { $addToSet: { accessByUsernames: joinRequest.requestuser } }
    );

    try {
      const client = await connectRedis();
      if (client && client.isOpen) {
        await client.del(`user:projects:${joinRequest.requestuser}`);
        await client.del(`user:projects:${project.username}`);
      }
    } catch (_) {}

    if (req.io) {
      req.io.to(`user_${joinRequest.requestuser}`).emit('join_request_approved', {
        message: `Your request to join "${project.projectname}" was approved!`,
        requestId: joinRequest._id.toString(),
        project: {
          id: updatedProject.id,
          _id: updatedProject._id,
          projectname: updatedProject.projectname,
          username: updatedProject.username,
          createdAt: updatedProject.createdAt,
          invitationCode: updatedProject.invitationCode,
          members: updatedProject.members,
          isActive: updatedProject.isActive,
        },
      });
    }

    return res.json({ success: true, message: 'Applicant added to workspace successfully.' });
  } catch (error) {
    console.error('Approve request error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = approve_project_request;