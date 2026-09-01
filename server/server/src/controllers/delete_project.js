require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const User = require('../models/User');
const RequestJoinProject = require('../models/RequestJoinProject');
const TeamLatency = require('../models/TeamLatency');
const ProjectLatency = require('../models/ProjectLatency');
const BlockedIP = require('../models/BlockedIP');
const ApiCallLog = require('../models/ApiCallLog');
const { connectRedis } = require('../config/redis');
const { clearProjectMockDefinitions } = require('../utils/redisMock');
const projectQueue = require('../queues/projectQueue');

// ─── Main controller ──────────────────────────────────────────
async function delete_project(req, res) {
  const { invitationCode, projectId: inputProjectId } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!invitationCode && !inputProjectId) {
    return res.status(400).json({ error: 'invitationCode or projectId is required' });
  }

  try {
    const query = invitationCode ? { invitationCode } : { id: inputProjectId };
    const project = await Project.findOne(query);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isCreator = project.username === username;
    const isAdmin = role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only project creators or admins can delete this project' });
    }

    const ownerUsername = project.username;
    const projectId = project.id;
    const invCode = project.invitationCode;

    // Cascade deletion in MongoDB collections
    await Promise.all([
      ProjectApiHistory.deleteMany({ $or: [{ projectID: projectId }, { projectCode: invCode }] }),
      SystemEventLog.deleteMany({ projectId }),
      RequestJoinProject.deleteMany({ invitationCode: invCode }),
      TeamLatency.deleteMany({ project_id: projectId }),
      ProjectLatency.deleteMany({ project_id: projectId }),
      BlockedIP.deleteMany({ project_id: projectId }),
      ApiCallLog.deleteMany({ project_id: projectId }),
      Project.deleteOne({ id: projectId }),
    ]);

    // Clean up Redis Mock Definitions safely
    try {
      await clearProjectMockDefinitions(projectId);
    } catch (e) {
      console.warn('[delete-project] Redis mock cleanup warning:', e.message);
    }

    // Clean up Invitation & Member Caches
    try {
      const client = await connectRedis();
      if (client && client.isOpen) {
        await client.del(`invitation:${invCode}`);
        const membersToInvalidate = new Set([project.username, ...(project.members || [])]);
        for (const member of membersToInvalidate) {
          await client.del(`user:projects:${member}`);
        }
      }
    } catch (e) {
      console.warn('[delete-project] Redis cache invalidation warning:', e.message);
    }

    // Decrement project count for the owner
    if (ownerUsername) {
      await User.updateOne({ username: ownerUsername, noofProjects: { $gt: 0 } }, { $inc: { noofProjects: -1 } });
    }

    // Queue delete job for worker container teardown
    try {
      await projectQueue.add(
        'delete',
        {
          action: 'delete',
          projectId,
        },
        {
          jobId: `delete_${projectId}_${Date.now()}`,
        }
      );
    } catch (e) {
      console.warn('[delete-project] BullMQ delete queue warning:', e.message);
    }

    if (req.io) {
      req.io.to(projectId).emit('project_deleted', { projectId });
      const allMembers = new Set([ownerUsername, ...(project.members || [])]);
      allMembers.forEach((member) => {
        req.io.to(`user_${member}`).emit('project_deleted', { projectId });
      });
    }

    try {
      const client = await connectRedis();
      if (client && client.isOpen) {
        await client.publish('api_history_update', JSON.stringify({ projectId, deleted: true }));
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Project '${projectId}' deleted successfully`,
    });
  } catch (error) {
    console.error('[delete-project] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = delete_project;