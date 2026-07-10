const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { redisClient } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');
const CODE_LENGTH = parseInt(process.env.INVITATION_CODE_LENGTH, 10);
const MAX_ATTEMPTS = parseInt(process.env.INVITATION_MAX_ATTEMPTS, 10);
const INVITATION_RESERVE_TTL = parseInt(process.env.INVITATION_RESERVE_TTL, 10);
const CHARSET = process.env.INVITATION_CHARSET;
const generateUniqueInvitationCode = async () => {
let attempts = 0;
while (attempts < MAX_ATTEMPTS) {
let code = '';
for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }
const redisKey = `invitation:${code}`;
if (!redisClient.isOpen) await redisClient.connect();
const existsInRedis = await redisClient.exists(redisKey);
if (!existsInRedis) {
const existsInDB = await Project.findOne({ invitationCode: code });
if (!existsInDB) {
await redisClient.setEx(redisKey, INVITATION_RESERVE_TTL, 'reserved');
return code;
      }
    }
    attempts++;
  }
return `INV-${Date.now()}`;
};
async function create_project(req, res) {
const { projectname } = req.body;
const username = req.user?.username;
const role = req.user?.role;
if (role === 'guest') {
return res.status(403).json({ error: "Guest users cannot create projects" });
  }
if (!username || !projectname || !projectname.trim()) {
return res.status(400).json({ error: "Valid username and project name are required" });
  }
try {
const trimmedProjectName = projectname.trim();
const generatedCustomId = `${username}_${trimmedProjectName.replace(/\s+/g, '_')}`;
const duplicateCheck = await Project.findOne({ id: generatedCustomId });
if (duplicateCheck) {
return res.status(400).json({ error: "You already have a workspace with this name" });
    }
const invitationCode = await generateUniqueInvitationCode();
const now = new Date();
const day = String(now.getDate()).padStart(2, '0');
const month = String(now.getMonth() + 1).padStart(2, '0');
const year = now.getFullYear();
let hours = now.getHours();
const minutes = String(now.getMinutes()).padStart(2, '0');
const seconds = String(now.getSeconds()).padStart(2, '0');
const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;
const newProject = {
      id: generatedCustomId,
      projectname: trimmedProjectName,
      username: username,
      createdAt: `${day}/${month}/${year} ${timeString}`,
      invitationCode: invitationCode,
      members: [username],
      isActive: true
    };
const savedProject = await Project.create(newProject);
const projectHistory = new ProjectApiHistory({
      projectID: generatedCustomId, // ✅ custom id
      projectCode: invitationCode,
      accessByUsernames: [username],
      endpoints: []
    });
await projectHistory.save();
await projectQueue.add('create', {
  action: 'create',
  projectId: generatedCustomId,
});
return res.status(201).json({
      success: true,
      invitationCode: invitationCode,
      project: savedProject
    });
  } catch (error) {
if (error.code === 11000) {
return res.status(409).json({ error: "Conflict detected. Please try again." });
    }
    console.error("Project creation error:", error);
return res.status(500).json({ error: "Failed to create project" });
  }
}
module.exports = create_project;


/*
const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const { redisClient } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');

const CODE_LENGTH = parseInt(process.env.INVITATION_CODE_LENGTH, 10);
const MAX_ATTEMPTS = parseInt(process.env.INVITATION_MAX_ATTEMPTS, 10);
const INVITATION_RESERVE_TTL = parseInt(process.env.INVITATION_RESERVE_TTL, 10);
const CHARSET = process.env.INVITATION_CHARSET;

const generateUniqueInvitationCode = async () => {
  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }
    const redisKey = `invitation:${code}`;
    if (!redisClient.isOpen) await redisClient.connect();
    const existsInRedis = await redisClient.exists(redisKey);
    if (!existsInRedis) {
      const existsInDB = await Project.findOne({ invitationCode: code });
      if (!existsInDB) {
        await redisClient.setEx(redisKey, INVITATION_RESERVE_TTL, 'reserved');
        return code;
      }
    }
    attempts++;
  }
  return `INV-${Date.now()}`;
};

async function create_project(req, res) {
  const { projectname } = req.body;
  const username = req.user.username;
  const role = req.user.role;

  if (role === 'guest') {
    return res.status(403).json({ error: "Guest users cannot create projects" });
  }
  if (!projectname || !projectname.trim()) {
    return res.status(400).json({ error: "Project name is required" });
  }

  const trimmedProjectName = projectname.trim();
  const generatedCustomId = `${username}_${trimmedProjectName.replace(/\s+/g, '_')}`;

  try {
    const duplicateCheck = await Project.findOne({ id: generatedCustomId });
    if (duplicateCheck) {
      return res.status(400).json({ error: "You already have a workspace with this name" });
    }

    const invitationCode = await generateUniqueInvitationCode();

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;

    const newProject = {
      id: generatedCustomId,
      projectname: trimmedProjectName,
      username,
      createdAt: `${day}/${month}/${year} ${timeString}`,
      invitationCode,
      members: [username],
      isActive: true
    };

    const savedProject = await Project.create(newProject);

    const projectHistory = new ProjectApiHistory({
      projectID: generatedCustomId,
      projectCode: invitationCode,
      accessByUsernames: [username],
      endpoints: []
    });
    await projectHistory.save();

    await projectQueue.add('create', {
      action: 'create',
      projectId: generatedCustomId,
    });

    // ---- Invalidate user cache (so GET /projects fetches fresh data) ----
    const cachePattern = `cache:${username}:*`;
    try {
      const keys = await redisClient.keys(cachePattern);
      if (keys.length) {
        await redisClient.del(keys);
      }
    } catch (err) {
      // Redis error – ignore, cache will expire via TTL
    }

    return res.status(201).json({
      success: true,
      invitationCode,
      project: savedProject
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Conflict detected. Please try again." });
    }
    console.error("[create-project] Error:", error);
    return res.status(500).json({ error: "Failed to create project" });
  }
}

module.exports = create_project;*/