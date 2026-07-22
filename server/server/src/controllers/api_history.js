
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');

const api_history = async (req, res) => {
  try {
    const { projectId } = req.query;
    const username = req.user?.username;

    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    if (!username) return res.status(401).json({ error: 'Authentication required' });

    const project = await Project.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isMember = project.username === username || (project.members && project.members.includes(username));
    if (!isMember) return res.status(403).json({ error: 'Access denied – not a member' });

    let projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
    if (!projectHistory) {
      projectHistory = new ProjectApiHistory({
        projectID: project._id.toString(),
        projectCode: project.invitationCode,
        accessByUsernames: [],
        endpoints: []
      });
      await projectHistory.save();
    }

    if (!projectHistory.accessByUsernames.includes(username)) {
      projectHistory.accessByUsernames.push(username);
      await projectHistory.save();
    }

    // ✅ Return versions array with version string and full URL
    const result = projectHistory.endpoints.map(ep => ({
      baseUrlPath: ep.baseUrlPath,
      versions: ep.versions.map(v => ({
        version: v.version,
        fullUrl: v.actualFullUrl
      }))
    }));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = api_history;

/*
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { internalRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

const api_history = async (req, res) => {
  const { projectId } = req.query;
  const username = req.user.username; // guaranteed by auth middleware

  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  // Build cache key
  const cacheKey = `cache:${username}:api_history:${projectId}`;

  try {
    // 1. Try to serve from Redis cache
    const cached = await internalRedis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return res.status(200).json(data);
    }
  } catch (err) {
    // Redis error – fall through to direct response
  }

  try {
    // 2. Fetch fresh data
    const project = await Project.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isMember = project.username === username || (project.members && project.members.includes(username));
    if (!isMember) return res.status(403).json({ error: 'Access denied – not a member' });

    let projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
    if (!projectHistory) {
      projectHistory = new ProjectApiHistory({
        projectID: project._id.toString(),
        projectCode: project.invitationCode,
        accessByUsernames: [],
        endpoints: []
      });
      await projectHistory.save();
    }

    if (!projectHistory.accessByUsernames.includes(username)) {
      projectHistory.accessByUsernames.push(username);
      await projectHistory.save();
    }

    // Build response
    const result = projectHistory.endpoints.map(ep => ({
      baseUrlPath: ep.baseUrlPath,
      versions: ep.versions.map(v => ({
        version: v.version,
        fullUrl: v.actualFullUrl
      }))
    }));

    // 3. Store in Redis cache
    try {
      await internalRedis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (err) {
      // Cache set failed – no problem, we already have the result
    }

    return res.json(result);
  } catch (error) {
    console.error('[api-history] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = api_history;*/


