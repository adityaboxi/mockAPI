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