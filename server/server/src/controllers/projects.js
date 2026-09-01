
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = 30; // 30 seconds cache for high throughput

async function projects(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (role === 'guest') {
    return res.status(403).json({ error: 'Guest users cannot view projects' });
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Valid username is required' });
  }

  const cacheKey = `user:projects:${username}`;

  try {
    const client = await connectRedis();
    const cached = await client.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }
  } catch (_) {}

  try {
    const userProjects = await Project.find({
      $or: [
        { username: username },
        { members: username },
      ],
    })
      .select('id projectname username invitationCode members createdAt isActive issubdcribe noofApis noofmemebers')
      .sort({ createdAt: -1 })
      .lean();

    const transformedProjects = userProjects.map((project) => {
      const isCreator = project.username === username;
      return {
        id: project.id,
        projectname: project.projectname,
        username: project.username,
        invitationCode: isCreator ? project.invitationCode : null,
        members: project.members || [],
        createdAt: project.createdAt,
        isActive: project.isActive !== undefined ? project.isActive : true,
        issubdcribe: Boolean(project.issubdcribe),
        noofApis: project.noofApis || 0,
        noofmemebers: project.noofmemebers || (project.members ? project.members.length : 1),
        isCreator,
      };
    });

    try {
      const client = await connectRedis();
      await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(transformedProjects));
    } catch (_) {}

    return res.json(transformedProjects);
  } catch (error) {
    console.error('Fetch projects error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

module.exports = projects;