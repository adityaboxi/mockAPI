const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');

async function get_user_apis(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const userProjects = await Project.find({ username: username });
    const result = [];

    for (const project of userProjects) {
      const projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
      const apis = [];

      if (projectHistory) {
        for (const endpoint of projectHistory.endpoints) {
          const versions = endpoint.versions.map((v, idx) => ({
            _id: `${endpoint.baseUrlPath}_${v.version}`,   // composite key that backend understands
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

    return res.json(result);
  } catch (error) {
    console.error("Error fetching user APIs:", error);
    return res.status(500).json({ error: "Failed to fetch user APIs" });
  }
}

module.exports = get_user_apis;



/*
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { internalRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

async function get_user_apis(req, res) {
  const username = req.user.username; // guaranteed by auth middleware

  const cacheKey = `cache:${username}:user_apis`;

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
    const userProjects = await Project.find({ username });

    const result = await Promise.all(userProjects.map(async (project) => {
      const projectHistory = await ProjectApiHistory.findOne({ projectCode: project.invitationCode });
      if (!projectHistory) return null;

      const apis = [];
      for (const endpoint of projectHistory.endpoints) {
        const versions = endpoint.versions.map((v, idx) => ({
          _id: `${endpoint.baseUrlPath}_${v.version}`,
          id: `${endpoint.baseUrlPath}_${idx}`,
          version: v.version,
          versionName: v.version || `v${idx + 1}`,
          versionString: v.version,
          fullUrl: v.actualFullUrl || '',
        }));
        if (versions.length) {
          apis.push({
            apiId: endpoint._id || endpoint.baseUrlPath,
            apiPath: endpoint.baseUrlPath,
            versions,
          });
        }
      }

      if (apis.length) {
        return {
          projectId: project.id,
          projectName: project.projectname,
          apis,
        };
      }
      return null;
    }));

    const filteredResult = result.filter(Boolean);

    // 2. Store in Redis cache
    try {
      await internalRedis.setex(cacheKey, CACHE_TTL, JSON.stringify(filteredResult));
    } catch (err) {
      // Cache set failed – no problem
    }

    return res.json(filteredResult);
  } catch (error) {
    console.error("[get-user-apis] Error:", error);
    return res.status(500).json({ error: "Failed to fetch user APIs" });
  }
}

module.exports = get_user_apis;*/