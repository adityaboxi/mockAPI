const Project = require('../models/Project');
const RequestJoinProject = require('../models/RequestJoinProject');

async function join_project(req, res) {
  const { joinCode } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(403).json({ error: "Not authorized to request workspace access" });
  }

  if (!joinCode) {
    return res.status(400).json({ error: "Join code is required" });
  }

  try {
    const normalizedCode = joinCode.trim().toUpperCase();

    const project = await Project.findOne({ invitationCode: normalizedCode, isActive: true });
    if (!project) {
      return res.status(404).json({ error: "Invalid or inactive project" });
    }

    if (project.username === username) {
      return res.status(400).json({ error: "You are the owner of this workspace" });
    }

    if (project.members?.includes(username)) {
      return res.status(400).json({ error: "You are already a member of this workspace" });
    }

    let createdRequest;
    try {
      createdRequest = await RequestJoinProject.create({
        invitationCode: project.invitationCode,
        requestuser: username,
        responseuser: project.username,
        isreqaccepted: false
      });
    } catch (dbError) {
      if (dbError.code === 11000) {
        return res.status(409).json({ error: "A pending join request already exists" });
      }
      throw dbError;
    }

    if (req.io) {
      req.io.to(`user_${project.username}`).emit('incoming_join_request', {
        id: createdRequest._id.toString(),
        requestuser: username,
        projectname: project.projectname,
        projectId: project.id || project._id.toString(),
        invitationCode: project.invitationCode
      });
    }

    return res.json({
      success: true,
      message: "Join request sent to project manager for approval"
    });

  } catch (error) {
    console.error("Join project error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = join_project;