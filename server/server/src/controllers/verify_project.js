const Project = require('../models/Project');

async function verify_project(req, res) {
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
    }

    try {
      
        // Query using the custom string 'id' field
        const project = await Project.findOne({
            id: projectId,
            isActive: true,
        });

        if (!project) {
            return res.status(403).json({ error: 'Invalid project' });
        }

        const hasAccess =
            project.username === req.user.username ||
            (project.members && project.members.includes(req.user.username)) ||
            req.user.role === 'admin';

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied – you are not a member of this project' });
        }

        return res.json({
            valid: true,
            project: {
                id: project.id,
                name: project.projectname,
                invitationCode: project.invitationCode,
            },
        });
    } catch (error) {
        console.error('Project verification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = verify_project;




/*
const Project = require('../models/Project');
const { internalRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

async function verify_project(req, res) {
  const { projectId } = req.body;
  const { username, role } = req.user; // guaranteed by auth middleware

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID required' });
  }

  const cacheKey = `cache:${username}:verify_project:${projectId}`;

  try {
    // 1. Try to serve from Redis cache
    const cached = await internalRedis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return res.json(data);
    }
  } catch (err) {
    // Redis error – fall through to database
  }

  try {
    const project = await Project.findOne({
      id: projectId,
      isActive: true,
    });

    if (!project) {
      return res.status(403).json({ error: 'Invalid project' });
    }

    const isMember = project.username === username || project.members.includes(username) || role === 'admin';
    if (!isMember) {
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

    // 2. Store in Redis cache
    try {
      await internalRedis.setex(cacheKey, CACHE_TTL, JSON.stringify(responseData));
    } catch (err) {
      // Cache set failed – no problem
    }

    return res.json(responseData);
  } catch (error) {
    console.error('[verify-project] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = verify_project;*/