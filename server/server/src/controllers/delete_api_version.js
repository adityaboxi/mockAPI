require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const SystemEventLog = require('../models/SystemEventLog');
const { deleteMockDefinition } = require('../utils/redisMock');
const { addMockSyncJob } = require('../queues/mockSyncQueue');
const { redisClient } = require('../config/redis');

async function delete_api_version(req, res) {
  const { versionId } = req.params;
  const { projectId } = req.query;
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!versionId || !projectId) {
    return res.status(400).json({ error: 'Missing versionId or projectId' });
  }

  try {
    const project = await Project.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isCreator = project.username === username;
    const isMember = project.members && project.members.includes(username);
    const isAdmin = role === 'admin';
    if (!isCreator && !isMember && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const projectHistory = await ProjectApiHistory.findOne({
      $or: [{ projectID: project.id }, { projectCode: project.invitationCode }],
    });
    if (!projectHistory) return res.status(404).json({ error: 'No API history found' });

    let targetEndpointIndex = -1;
    let targetVersionIndex = -1;
    let deletedVersion = null;
    let endpointBasePath = null;
    let method = null;

    outer: for (let i = 0; i < projectHistory.endpoints.length; i++) {
      const endpoint = projectHistory.endpoints[i];
      for (let j = 0; j < endpoint.versions.length; j++) {
        const v = endpoint.versions[j];
        const matchesId = v._id?.toString() === versionId;
        const matchesVersion = v.version === versionId;
        const matchesComposite = `${endpoint.baseUrlPath}_${v.version}` === versionId;
        if (matchesId || matchesVersion || matchesComposite) {
          targetEndpointIndex = i;
          targetVersionIndex = j;
          deletedVersion = v;
          endpointBasePath = endpoint.baseUrlPath;
          method = v.method;
          break outer;
        }
      }
    }

    if (targetEndpointIndex === -1) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const endpoint = projectHistory.endpoints[targetEndpointIndex];
    endpoint.versions.splice(targetVersionIndex, 1);
    endpoint.noofVersions = endpoint.versions.length;

    let endpointRemoved = false;
    if (endpoint.versions.length === 0) {
      projectHistory.endpoints.splice(targetEndpointIndex, 1);
      endpointRemoved = true;
    }

    await projectHistory.save();

    if (endpointRemoved) {
      await Project.updateOne({ id: projectId, noofApis: { $gt: 0 } }, { $inc: { noofApis: -1 } });
    }

    const customId = project.id;
    try {
      await deleteMockDefinition(customId, deletedVersion.version, method, endpointBasePath);
    } catch (cacheErr) {
      console.warn('[delete-api-version] deleteMockDefinition warning:', cacheErr.message);
    }

    try {
      await addMockSyncJob('delete', {
        projectId: customId,
        version: deletedVersion.version,
        method,
        urlpath: endpointBasePath,
      });
    } catch (queueErr) {
      console.warn('[delete-api-version] addMockSyncJob warning:', queueErr.message);
    }

    let newLog = null;
    try {
      newLog = await SystemEventLog.create({
        projectId: project.id,
        method: (method || 'GET').toUpperCase(),
        url: endpointBasePath,
        action: 'deleted',
        version: deletedVersion.version,
        username,
        statusCode: 200,
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.warn('[delete-api-version] SystemEventLog warning:', logErr.message);
    }

    if (req.io && newLog) {
      req.io.to(project.id).emit('new_api_log', newLog.toObject ? newLog.toObject() : newLog);
      req.io.to(project.id).emit('api_history_update', { projectId: project.id });
    }

    try {
      if (redisClient && redisClient.isOpen) {
        const keys = await redisClient.keys(`api_history:${project.id}:*`);
        if (keys && keys.length > 0) {
          await redisClient.del(keys);
        }
        const userApiKeys = await redisClient.keys(`user_apis:*`);
        if (userApiKeys && userApiKeys.length > 0) {
          await redisClient.del(userApiKeys);
        }
        await redisClient.publish('api_history_update', JSON.stringify({ projectId: project.id }));
      }
    } catch (_) {}

    return res.status(200).json({ success: true, message: 'Version deleted successfully' });
  } catch (error) {
    console.error('[delete-api-version] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = delete_api_version;