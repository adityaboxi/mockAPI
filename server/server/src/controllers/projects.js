/*const Project = require('../models/Project');

async function projects(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (role === 'guest') {
    return res.status(400).json({ error: "Valid username is required" });
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: "Valid username is required" });
  }

  try {
    const userProjects = await Project.find({
      $or: [
        { username: username },
        { members: { $in: [username] } }
      ]
    })
    .select('id projectname username invitationCode members createdAt isActive')
    .sort({ createdAt: -1, projectname: 1 })
    .lean();

    const transformedProjects = userProjects.map(project => {
      const isCreator = project.username === username;
      
      return {
        id: project.id,
        projectname: project.projectname,
        username: project.username,
        invitationCode: isCreator ? project.invitationCode : null,
        members: project.members,
        createdAt: project.createdAt,
        isActive: project.isActive !== undefined ? project.isActive : true,
        isCreator: isCreator
      };
    });

    res.json(transformedProjects);
  } catch (error) {
    console.error("Fetch projects error:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
}

module.exports = projects;*/


const Project = require('../models/Project');
const { internalRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

async function projects(req, res) {
  const { username, role } = req.user; // guaranteed by auth middleware

  if (role === 'guest') {
    return res.status(403).json({ error: 'Guests cannot view projects' });
  }

  const cacheKey = `cache:${username}:projects`;

  try {
    // 1. Try to serve from Redis cache
    const cached = await internalRedis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return res.status(200).json(data);
    }
  } catch (err) {
    // Redis error – fall through to database
  }

  try {
    const userProjects = await Project.find({
      $or: [
        { username },
        { members: { $in: [username] } }
      ]
    })
      .select('id projectname username invitationCode members createdAt isActive')
      .sort({ createdAt: -1, projectname: 1 })
      .lean();

    const transformedProjects = userProjects.map(project => ({
      id: project.id,
      projectname: project.projectname,
      username: project.username,
      invitationCode: project.username === username ? project.invitationCode : null,
      members: project.members,
      createdAt: project.createdAt,
      isActive: project.isActive, // schema default ensures it's always present
      isCreator: project.username === username
    }));

    // 2. Store in Redis cache
    try {
      await internalRedis.setex(cacheKey, CACHE_TTL, JSON.stringify(transformedProjects));
    } catch (err) {
      // Cache set failed – no problem
    }

    return res.json(transformedProjects);
  } catch (error) {
    console.error('[projects] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

module.exports = projects;