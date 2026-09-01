// server/server/src/controllers/updateProjectStatus.js
require('../opentelemetry/universal-logger');

const Project = require('../models/Project');
const { connectRedis } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');
const cache = require('../services/cacheService');

async function updateProjectStatus(req, res) {
  const { projectId } = req.params;
  const { isActive } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.username !== username && role !== 'admin') {
      return res.status(403).json({ error: 'Only project creators or admins can change status' });
    }

    project.isActive = isActive;
    await project.save();

    // 1. Dispatch background orchestration job
    await projectQueue.add(
      'update',
      {
        action: 'update',
        projectId: project.id,
        isActive: isActive,
      },
      { jobId: `update_${project.id}_${isActive}_${Date.now()}` }
    );

    // 2. Invalidate Redis Caches
    try {
      await cache.invalidate('projects', project.id);
      const usersToInvalidate = new Set([project.username, ...(project.members || [])]);
      for (const user of usersToInvalidate) {
        await cache.invalidate('projects', user);
      }
      await cache.invalidateLists('projects');
    } catch (cacheError) {
      console.error('[updateProjectStatus] Cache invalidation error:', cacheError.message);
    }

    // 3. Emit Real-time WebSocket Updates
    const io = req.io || req.app?.get('io');
    if (io) {
      io.to(project.id).emit('project_status_changed', {
        projectId: project.id,
        isActive: project.isActive,
      });

      const allMembers = new Set([project.username, ...(project.members || [])]);
      allMembers.forEach((member) => {
        io.to(`user_${member}`).emit('project_status_changed', {
          projectId: project.id,
          isActive: project.isActive,
        });
      });
    }

    // 4. Publish to Redis Pub/Sub
    try {
      const client = await connectRedis();
      if (client.isOpen) {
        await client.publish(
          'api_history_update',
          JSON.stringify({ projectId: project.id, isActive: project.isActive })
        );
      }
    } catch (_) {}

    return res.json({ success: true, project });
  } catch (error) {
    console.error('Update project status error:', error.message);
    return res.status(500).json({ error: 'Failed to update status' });
  }
}

module.exports = updateProjectStatus;