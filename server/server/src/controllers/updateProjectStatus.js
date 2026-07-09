const Project = require('../models/Project');
const { redisClient } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');
async function updateProjectStatus(req, res) {
const { projectId } = req.params;
const { isActive } = req.body;
const username = req.user?.username;
const role = req.user?.role;
if (typeof isActive !== 'boolean') {
return res.status(400).json({ error: "isActive must be boolean" });
  }
if (!username) {
return res.status(401).json({ error: "Authentication required" });
  }
try {
if (!redisClient.isOpen) await redisClient.connect();
const project = await Project.findOne({ id: projectId }); 
if (!project) {
return res.status(404).json({ error: "Project not found" });
    }
if (project.username !== username && role !== 'admin') {
return res.status(403).json({ error: "Only project creators or admins can change status" });
    }
    project.isActive = isActive;
await project.save();
await projectQueue.add('update', {
      action: 'update',
      projectId: project.id,
      isActive: isActive,
    }, { jobId: `update_${project.id}_${isActive}_${Date.now()}` });
await redisClient.del(`user:projects:${project.username}`);
for (const member of project.members) {
await redisClient.del(`user:projects:${member}`);
    }
if (req.io) {
      req.io.to(project.id).emit('project_status_changed', {
        projectId: project.id,
        isActive: project.isActive
      });
    }
return res.json({ success: true, project });
  } catch (error) {
    console.error("Update project status error:", error);
return res.status(500).json({ error: "Failed to update status" });
  }
}
module.exports = updateProjectStatus;