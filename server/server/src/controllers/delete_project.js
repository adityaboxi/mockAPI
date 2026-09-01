require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const User = require('../models/User');                 // <-- added
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
      } else {
        console.warn('⚠️ Skipping invalid key from scan:', key);
      }
    }
  }
  return deletedCount;
}

// ─── Main controller ──────────────────────────────────────────
async function delete_project(req, res) {
  const { invitationCode } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  // ─── 1. Authentication ────────────────────────────────────
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!invitationCode) {
    return res.status(400).json({ error: 'invitationCode is required' });
  }

  try {
    // ─── 2. Find project ────────────────────────────────────
    const project = await Project.findOne({ invitationCode });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ─── 3. Authorization ───────────────────────────────────
    const isCreator = project.username === username;
    const isAdmin = role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only project creators or admins can delete this project' });
    }

    // Store owner username for later use
    const ownerUsername = project.username;

    // ─── 4. Delete associated history & logs ────────────────
    await ProjectApiHistory.deleteOne({ projectCode: invitationCode });
    await SystemEventLog.deleteMany({ projectId: project.id });

    // ─── 5. Delete Redis mock definitions ──────────────────
    await deleteMockDefinitionsForProject(project.id);

    // ─── 6. Delete invitation key ──────────────────────────
    if (!redisClient.isOpen) await redisClient.connect();
    await redisClient.del(`invitation:${invitationCode}`);

    // ─── 7. Invalidate user caches ──────────────────────────
    const membersToInvalidate = new Set([project.username, ...project.members]);
    for (const member of membersToInvalidate) {
      await redisClient.del(`user:projects:${member}`);
    }

    // ─── 8. Delete project document ──────────────────────────
    await Project.deleteOne({ id: project.id });

    // ─── 9. Decrement project count for the owner ──────────
    //    We do this AFTER successful deletion to avoid count inconsistency.
    if (ownerUsername) {
      const updatedUser = await User.findOneAndUpdate(
        { username: ownerUsername, noofProjects: { $gt: 0 } },   // only decrement if >0
        { $inc: { noofProjects: -1 } },
        { new: true }
      );
      if (updatedUser) {
        console.log(`[delete-project] Decremented project count for ${ownerUsername} – new count: ${updatedUser.noofProjects}`);
      } else {
        console.warn(`[delete-project] Could not decrement count for ${ownerUsername} – user not found or count already 0.`);
      }
    }

    // ─── 10. Queue delete job for worker ────────────────────
    await projectQueue.add('delete', {
      action: 'delete',
      projectId: project.id,
    }, {
      jobId: `delete_${project.id}_${Date.now()}`,
    });

    // ─── 11. Emit socket event ─────────────────────────────
    if (req.io) {
      req.io.to(project.id).emit('project_deleted', { projectId: project.id });
    }

    return res.status(200).json({
      success: true,
      message: `Project '${project.id}' deleted successfully`,
    });

  } catch (error) {
    console.error('[delete-project] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = delete_project;