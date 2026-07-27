require('../opentelemetry/universal-logger');

const mongoose = require('mongoose');
const Project = require('../models/Project');
const RequestJoinProject = require('../models/RequestJoinProject');
const ProjectApiHistory = require('../models/ProjectApiHistory');

async function approve_project_request(req, res) {
  const { requestId } = req.params;
  const managerUsername = req.user?.username;

  if (!managerUsername) return res.status(401).json({ error: "Unauthorized" });

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({ error: "Invalid request ID format" });
  }

  try {
    const joinRequest = await RequestJoinProject.findById(requestId);
    if (!joinRequest) return res.status(404).json({ error: "Join request not found" });
    if (joinRequest.responseuser !== managerUsername) return res.status(403).json({ error: "Unauthorized action" });
    if (joinRequest.isreqaccepted) return res.status(400).json({ error: "Request already processed" });

    const project = await Project.findOne({ invitationCode: joinRequest.invitationCode, isActive: true });
    if (!project) return res.status(404).json({ error: "Workspace is no longer active or missing" });

    // ─── Capacity check based on subscription ────────────
    // NEW LIMITS: subscribed → 2 members, non‑subscribed → 1 member
    const maxMembers = project.issubdcribe ? 2 : 1;
    if (project.noofmemebers >= maxMembers) {
      return res.status(400).json({
        error: `Project has reached the maximum of ${maxMembers} member(s). Cannot accept more join requests.`
      });
    }

    // ─── Add member only if not already present ──────────
    let memberAdded = false;
    if (!project.members.includes(joinRequest.requestuser)) {
      project.members.push(joinRequest.requestuser);
      project.noofmemebers = (project.noofmemebers || 0) + 1;
      memberAdded = true;
    }

    await project.save();

    // ─── Update project API history ─────────────────────
    await ProjectApiHistory.updateOne(
      { projectCode: project.invitationCode },
      { $addToSet: { accessByUsernames: joinRequest.requestuser } }
    );

    // ─── Mark request as accepted ──────────────────────
    joinRequest.isreqaccepted = true;
    await joinRequest.save();

    // ─── Real‑time notification ─────────────────────────
    if (req.io) {
      req.io.to(`user_${joinRequest.requestuser}`).emit('join_request_approved', {
        message: `Your request to join "${project.projectname}" was approved!`,
        requestId: joinRequest._id.toString(),
        project: {
          id: project.id,
          _id: project._id,
          projectname: project.projectname,
          username: project.username,
          createdAt: project.createdAt,
          invitationCode: project.invitationCode,
          members: project.members,
          isActive: project.isActive
        }
      });
    }

    return res.json({ success: true, message: "Applicant added to workspace successfully." });
  } catch (error) {
    console.error("Approve request error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = approve_project_request;