
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = 30; // 30 seconds cache

const api_history = async (req, res) => {
  try {
    const { projectId } = req.query;
    const username = req.user?.username;

    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    if (!username) return res.status(401).json({ error: 'Authentication required' });

    const cacheKey = `api_history:${projectId}:${username}`;
    try {
      const client = await connectRedis();
      const cached = await client.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (_) {}

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isMember =
      project.username === username || (project.members && project.members.includes(username));
    if (!isMember) return res.status(403).json({ error: 'Access denied – not a member' });

    let projectHistory = await ProjectApiHistory.findOne({
      $or: [{ projectID: project.id }, { projectCode: project.invitationCode }],
    });

    if (!projectHistory) {
      projectHistory = new ProjectApiHistory({
        projectID: project.id,
        projectCode: project.invitationCode,
        accessByUsernames: [username],
        endpoints: [],
      });
      await projectHistory.save();
    } else if (!projectHistory.accessByUsernames.includes(username)) {
      projectHistory.accessByUsernames.push(username);
      await projectHistory.save();
    }

    const result = (projectHistory.endpoints || []).map((ep) => ({
      baseUrlPath: ep.baseUrlPath,
      versions: (ep.versions || []).map((v) => ({
        version: v.version,
        fullUrl: v.actualFullUrl || '',
      })),
    }));

    try {
      const client = await connectRedis();
      await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (_) {}

    return res.json(result);
  } catch (error) {
    console.error('api_history error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

module.exports = api_history;