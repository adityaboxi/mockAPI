require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const SystemEventLog = require('../models/SystemEventLog');
const { connectRedis } = require('../config/redis');

async function logs(req, res) {
  try {
    const { projectId, method, url, action, version, username, accessByUsername, statusCode } = req.body;

    if (!projectId || !action || !username) {
      return res.status(400).json({ error: 'Missing required fields: projectId, action, username' });
    }

    const newLog = await SystemEventLog.create({
      projectId,
      method: method || 'GET',
      url: url || '/',
      action,
      version: version || 'v1',
      username,
      accessByUsername: accessByUsername || [],
      statusCode: statusCode || 200,
    });

    try {
      const client = await connectRedis();
      if (client && client.isOpen) {
        await client.publish('ws:new_api_log', JSON.stringify({
          project_id: projectId,
          projectId: projectId,
          method: method || 'GET',
          path: url || '/',
          status: Number(statusCode) || 200,
          statusCode: Number(statusCode) || 200,
          timestamp: new Date(),
          latency_ms: 0,
          total_latency: 0,
        }));
      } else if (req.io && projectId) {
        req.io.to(projectId).emit('new_api_log', newLog.toObject ? newLog.toObject() : newLog);
      }
    } catch (_) {
      if (req.io && projectId) {
        req.io.to(projectId).emit('new_api_log', newLog.toObject ? newLog.toObject() : newLog);
      }
    }

    return res.status(201).json({ success: true, message: 'System event logged successfully' });
  } catch (error) {
    console.error('[logs] Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = logs;