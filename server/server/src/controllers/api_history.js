
require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { connectRedis } = require('../config/redis');

const api_history = async (req, res) => {
  try {
    const { projectId } = req.query;
    const username = req.user?.username;

    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!username) return res.status(401).json({ error: 'Authentication required' });

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isMember =
      project.username === username ||
      (project.members && project.members.includes(username)) ||
      req.user?.role === 'admin';

    if (!isMember) return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });

    let projectHistory = await ProjectApiHistory.findOne({
      $or: [
        { projectID: project.id },
        { projectID: project._id ? project._id.toString() : null },
        { projectCode: project.invitationCode },
      ].filter(Boolean),
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

    // Return versions array with version string and full URL
    const result = (projectHistory.endpoints || []).map((ep) => ({
      baseUrlPath: ep.baseUrlPath,
      versions: (ep.versions || []).map((v) => ({
        version: v.version,
        fullUrl: v.actualFullUrl || '',
        method: v.method || 'GET',
      })),
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('[api-history] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

module.exports = api_history;