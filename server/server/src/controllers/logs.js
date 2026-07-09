const SystemEventLog = require('../models/SystemEventLog');

async function logs(req, res) {
  try {
    const { projectId, method, url, action, version, username, accessByUsername, statusCode } = req.body;
    
    const newLog = await SystemEventLog.create({
      projectId,
      method,
      url,
      action,
      version,
      username,
      accessByUsername: accessByUsername || [],
      statusCode: statusCode || 200
    });
    
    if (req.io && projectId) {
      req.io.to(projectId).emit('new_api_log', newLog);
    }
    
    res.status(201).json({ success: true, message: "System event logged successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = logs;