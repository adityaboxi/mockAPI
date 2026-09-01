require('../opentelemetry/universal-logger'); // OpenTelemetry tracing initialized first

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
    // ─── 1. Fetch project ──────────────────────────────────
    const project = await Project.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isCreator = project.username === username;
    const isAdmin = role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied: Only workspace creators or admins can delete API versions' });
    }

    // ─── 2. Fetch project history ──────────────────────────
    const projectHistory = await ProjectApiHistory.findOne({
      $or: [
        { projectID: project.id },
        { projectID: project._id ? project._id.toString() : null },
        { projectCode: project.invitationCode },
      ].filter(Boolean),
    });
    if (!projectHistory) return res.status(404).json({ error: 'No API history found' });

    // ─── 3. Find the version to delete ────────────────────
    let targetEndpointIndex = -1;
    let targetVersionIndex = -1;
    let deletedVersion = null;
    let endpointBasePath = null;
    let method = null;

    outer: for (let i = 0; i < (projectHistory.endpoints || []).length; i++) {
      const endpoint = projectHistory.endpoints[i];
      for (let j = 0; j < (endpoint.versions || []).length; j++) {
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

    // ─── 4. Remove the version from the endpoint ──────────
    const endpoint = projectHistory.endpoints[targetEndpointIndex];
    endpoint.versions.splice(targetVersionIndex, 1);

    // ─── 5. Update the version count on the endpoint ──────
    endpoint.noofVersions = endpoint.versions.length;

    // ─── 6. If no versions left, remove the endpoint ──────
    let endpointRemoved = false;
    if (endpoint.versions.length === 0) {
      projectHistory.endpoints.splice(targetEndpointIndex, 1);
      endpointRemoved = true;
    }

    // ─── 7. Save history ──────────────────────────────────
    await projectHistory.save();

    // ─── 8. If endpoint was removed, decrement project API count ──
    if (endpointRemoved) {
      project.noofApis = Math.max(0, (project.noofApis || 1) - 1);
      await project.save();
    }

    // ─── 9. Clean up Redis and queue ──────────────────────
    const customId = project.id;
    await deleteMockDefinition(customId, deletedVersion.version, method, endpointBasePath);
    await addMockSyncJob('delete', {
      projectId: customId,
      version: deletedVersion.version,
      method,
      urlpath: endpointBasePath,
    });

    // ─── 10. Log event & broadcast ─────────────────────────
    const newLog = await SystemEventLog.create({
      projectId: project.id,
      method,
      url: endpointBasePath,
      action: 'deleted',
      version: deletedVersion.version,
      username,
      statusCode: 200,
      createdAt: new Date(),
    });

    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.del(`api_history:${projectId}`);
        await redisClient.del(`user_apis:${username}`);
        await redisClient.publish('api_history_update', JSON.stringify({ projectId }));
      }
    } catch (_) {}

    if (req.io) {
      req.io.to(project.id).emit('new_api_log', newLog.toObject ? newLog.toObject() : newLog);
      req.io.to(project.id).emit('api_history_update', { projectId });
    }

    return res.status(200).json({ success: true, message: 'Version deleted successfully' });
  } catch (error) {
    console.error('[delete-api-version] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

module.exports = delete_api_version;