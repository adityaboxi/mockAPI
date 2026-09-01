require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const User = require('../models/User');
const { redisClient } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');

// ─── Helper: delete mock definitions from Redis ──────────────
async function deleteMockDefinitionsForProject(projectId) {
  if (!redisClient.isOpen) await redisClient.connect();
  const pattern = `mockapi:def:${projectId}:*`;
  let deletedCount = 0;
  for await (const item of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    const batch = Array.isArray(item) ? item : [item];
    for (const key of batch) {
      if (typeof key === 'string' && key.trim() !== '') {
        await redisClient.del(key);
        deletedCount++;
      }
    }
  }
  return deletedCount;
}

// ─── Main controller ──────────────────────────────────────────
async function delete_project(req, res) {
  const { invitationCode, projectId } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  // ─── 1. Authentication ────────────────────────────────────
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!invitationCode && !projectId) {
    return res.status(400).json({ error: 'invitationCode or projectId is required' });
  }

  try {
    // ─── 2. Find project ────────────────────────────────────
    const project = await Project.findOne(
      projectId ? { id: projectId } : { invitationCode }
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ─── 3. Authorization ───────────────────────────────────
    const isCreator = project.username === username;
    const isAdmin = role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only workspace creators or admins can delete this workspace' });
    }

    const ownerUsername = project.username;
    const projectCode = project.invitationCode;
    const customId = project.id;

    // ─── 4. Delete associated history & logs ────────────────
    await ProjectApiHistory.deleteMany({
      $or: [{ projectID: customId }, { projectCode }],
    });
    await SystemEventLog.deleteMany({ projectId: customId });

    // ─── 5. Delete Redis mock definitions ──────────────────
    try {
      await deleteMockDefinitionsForProject(customId);
    } catch (_) {}

    // ─── 6. Delete invitation key ──────────────────────────
    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.del(`invitation:${projectCode}`);
      }
    } catch (_) {}

    // ─── 7. Invalidate user caches ──────────────────────────
    try {
      const membersToInvalidate = new Set([project.username, ...(project.members || [])]);
      if (redisClient && redisClient.isOpen) {
        for (const member of membersToInvalidate) {
          await redisClient.del(`user:projects:${member}`);
          await redisClient.del(`user_apis:${member}`);
          await redisClient.del(`dashboard:${member}`);
        }
      }
    } catch (_) {}

    // ─── 8. Delete project document ──────────────────────────
    await Project.deleteOne({ id: customId });

    // ─── 9. Decrement project count for the owner ──────────
    if (ownerUsername) {
      await User.findOneAndUpdate(
        { username: ownerUsername, noofProjects: { $gt: 0 } },
        { $inc: { noofProjects: -1 } },
        { new: true }
      ).catch(() => {});
    }

    // ─── 10. Queue delete job for worker ────────────────────
    try {
      await projectQueue.add('delete', {
        action: 'delete',
        projectId: customId,
      }, {
        jobId: `delete_${customId}_${Date.now()}`,
      });
    } catch (_) {}

    // ─── 11. Emit socket event ─────────────────────────────
    if (req.io) {
      req.io.to(customId).emit('project_deleted', { projectId: customId });
    }

    return res.status(200).json({
      success: true,
      message: `Workspace '${customId}' deleted successfully`,
    });

  } catch (error) {
    console.error('[delete-project] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = delete_project;