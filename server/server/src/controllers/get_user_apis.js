require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { connectRedis } = require('../config/redis');

const CACHE_TTL = 30; // 30 seconds cache

async function get_user_apis(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const cacheKey = `user_apis:${username}`;

  try {
    const client = await connectRedis();
    const cached = await client.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }
  } catch (_) {}

  try {
    const userProjects = await Project.find({
      $or: [{ username: username }, { members: username }],
    })
      .select('id projectname invitationCode')
      .lean();

    if (!userProjects.length) {
      return res.json([]);
    }

    const projectIds = userProjects.map((p) => p.id);
    const invCodes = userProjects.map((p) => p.invitationCode).filter(Boolean);

    const histories = await ProjectApiHistory.find({
      $or: [{ projectID: { $in: projectIds } }, { projectCode: { $in: invCodes } }],
    }).lean();

    const historyMap = new Map();
    for (const h of histories) {
      if (h.projectID) historyMap.set(h.projectID, h);
      if (h.projectCode) historyMap.set(h.projectCode, h);
    }

    const result = [];
    for (const project of userProjects) {
      const projectHistory = historyMap.get(project.id) || historyMap.get(project.invitationCode);
      const apis = [];

      if (projectHistory && Array.isArray(projectHistory.endpoints)) {
        for (const endpoint of projectHistory.endpoints) {
          const versions = (endpoint.versions || []).map((v, idx) => ({
            _id: `${endpoint.baseUrlPath}_${v.version}`,
            id: `${endpoint.baseUrlPath}_${idx}`,
            version: v.version,
            versionName: v.version || `v${idx + 1}`,
            versionString: v.version,
            fullUrl: v.actualFullUrl || '',
          }));
          if (versions.length > 0) {
            apis.push({
              apiId: endpoint._id || `${endpoint.baseUrlPath}`,
              apiPath: endpoint.baseUrlPath,
              versions: versions,
            });
          }
        }
      }

      if (apis.length > 0) {
        result.push({
          projectId: project.id,
          projectName: project.projectname,
          apis: apis,
        });
      }
    }

    try {
      const client = await connectRedis();
      await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (_) {}

    return res.json(result);
  } catch (error) {
    console.error('Error fetching user APIs:', error.message);
    return res.status(500).json({ error: 'Failed to fetch user APIs' });
  }
}

module.exports = get_user_apis;