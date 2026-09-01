require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = 60; // 1 minute

async function verify_project(req, res) {
  const { projectId } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID required' });
  }

  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const cacheKey = `verify:${username}:${projectId}`;

  try {
    const client = await connectRedis();
    const cached = await client.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (_) {}

  try {
    const project = await Project.findOne({
      id: projectId,
      isActive: true,
    }).lean();

    if (!project) {
      return res.status(403).json({ error: 'Invalid project' });
    }

    const hasAccess =
      project.username === username ||
      (project.members && project.members.includes(username)) ||
      role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied – you are not a member of this project' });
    }

    const responseData = {
      valid: true,
      project: {
        id: project.id,
        name: project.projectname,
        invitationCode: project.invitationCode,
      },
    };

    try {
      const client = await connectRedis();
      await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(responseData));
    } catch (_) {}

    return res.json(responseData);
  } catch (error) {
    console.error('Project verification error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = verify_project;