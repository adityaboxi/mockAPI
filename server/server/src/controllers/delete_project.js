const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { redisClient } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');

async function deleteMockDefinitionsForProject(projectId) {
  if (!redisClient.isOpen) await redisClient.connect();
  const pattern = `mockapi:def:${projectId}:*`;
  let deletedCount = 0;

  for await (const item of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    // scanIterator has been observed yielding either a single key (string)
    // or a batch of keys (array) depending on client version — handle both.
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

  if (deletedCount > 0) {
    console.log(`🗑️ Redis DEL: ${deletedCount} mock definition keys`);
  } else {
    console.log('ℹ️ No mock definition keys found to delete.');
  }
  return deletedCount;
}



/**
 * DELETE /api/deleteproject
 * Body: { invitationCode: "ABC123" }
 */
async function delete_project(req, res) {
  const { invitationCode } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  // 1. Authentication & validation
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!invitationCode) {
    return res.status(400).json({ error: 'invitationCode is required' });
  }

  try {
    // 2. Find project by invitation code
    const project = await Project.findOne({ invitationCode });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 3. Authorization
    const isCreator = project.username === username;
    const isAdmin = role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only project creators or admins can delete this project' });
    }

    // 4. Delete associated API history and event logs
    await ProjectApiHistory.deleteOne({ projectCode: invitationCode });
    await SystemEventLog.deleteMany({ projectId: project.id });

    // 5. Delete all mock definitions from Redis (safe batch deletion)
    await deleteMockDefinitionsForProject(project.id);

    // 6. Delete invitation key from Redis
    if (!redisClient.isOpen) await redisClient.connect();
    await redisClient.del(`invitation:${invitationCode}`);

    // 7. Invalidate user project caches
    const membersToInvalidate = new Set([project.username, ...project.members]);
    for (const member of membersToInvalidate) {
      await redisClient.del(`user:projects:${member}`);
    }

    // 8. Delete the project document
    await Project.deleteOne({ id: project.id });

    // 9. Enqueue a job for the worker (delete container + internal route)
    await projectQueue.add('delete', {
      action: 'delete',
      projectId: project.id,   // Worker uses this as the route key
    }, {
      jobId: `delete_${project.id}_${Date.now()}`,
    });

    console.log(`[ProjectQueue] Delete job enqueued for ${project.id}`);

    // 10. Emit socket event if available
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