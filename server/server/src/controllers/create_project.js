require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const User = require('../models/User');
const { connectRedis } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');

const CODE_LENGTH = parseInt(process.env.INVITATION_CODE_LENGTH, 10) || 6;
const MAX_ATTEMPTS = parseInt(process.env.INVITATION_MAX_ATTEMPTS, 10) || 10;
const INVITATION_RESERVE_TTL = parseInt(process.env.INVITATION_RESERVE_TTL, 10) || 30;
const CHARSET = process.env.INVITATION_CHARSET || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─── Helper: generate unique invitation code ──────────────
const generateUniqueInvitationCode = async () => {
  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }
    const redisKey = `invitation:${code}`;
    try {
      const client = await connectRedis();
      if (client && client.isOpen) {
        const existsInRedis = await client.exists(redisKey);
        if (!existsInRedis) {
          const existsInDB = await Project.findOne({ invitationCode: code }).lean();
          if (!existsInDB) {
            await client.setEx(redisKey, INVITATION_RESERVE_TTL, 'reserved');
            return code;
          }
        }
      }
    } catch (_) {
      const existsInDB = await Project.findOne({ invitationCode: code }).lean();
      if (!existsInDB) {
        return code;
      }
    }
    attempts++;
  }
  return `INV-${Date.now().toString(36).toUpperCase()}`;
};

// ─── Main controller ──────────────────────────────────────────
async function create_project(req, res) {
  const { projectname } = req.body;
  const username = req.user?.username;

  // ─── 1. Basic validation ─────────────────────────────────
  if (!username || !projectname || !projectname.trim()) {
    return res.status(400).json({ error: 'Valid username and project name are required' });
  }

  try {
    // ─── 2. Fetch user from DB ─────────────────────────────
    const user = await User.findOne({ username })
      .select('role subscribe noofProjects')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'guest') {
      return res.status(403).json({ error: 'Guest users cannot create projects' });
    }

    // ─── 3. Determine project limit ─────────────────────────
    const maxProjects = user.subscribe ? 5 : 2;

    // ─── 4. Atomic check + increment ────────────────────────
    const updatedUser = await User.findOneAndUpdate(
      {
        username,
        $or: [
          { noofProjects: { $lt: maxProjects } },
          { noofProjects: { $exists: false } },
        ],
      },
      {
        $inc: { noofProjects: 1 },
      },
      {
        new: true,
        select: 'noofProjects',
      }
    );

    if (!updatedUser) {
      return res.status(403).json({
        error: `You have reached the maximum of ${maxProjects} projects. ${
          user.subscribe ? 'Please upgrade your plan.' : 'Upgrade to create more.'
        }`,
      });
    }

    // ─── 5. Duplicate check ─────────────────────────────────
    const trimmedProjectName = projectname.trim();
    const generatedCustomId = `${username}_${trimmedProjectName.replace(/\s+/g, '_')}`;
    const duplicateCheck = await Project.findOne({ id: generatedCustomId }).lean();
    if (duplicateCheck) {
      await User.updateOne({ username }, { $inc: { noofProjects: -1 } });
      return res.status(400).json({ error: 'You already have a workspace with this name' });
    }

    // ─── 6. Generate invitation code ──────────────────────
    const invitationCode = await generateUniqueInvitationCode();

    // ─── 7. Build project object ────────────────────────────
    const newProject = {
      id: generatedCustomId,
      projectname: trimmedProjectName,
      username: username,
      invitationCode: invitationCode,
      members: [username],
      isActive: true,
      issubdcribe: Boolean(user.subscribe),
      noofApis: 0,
      noofmemebers: 1,
    };

    // ─── 8. Save project ────────────────────────────────────
    const savedProject = await Project.create(newProject);

    // ─── 9. Create project history ──────────────────────────
    const projectHistory = new ProjectApiHistory({
      projectID: generatedCustomId,
      projectCode: invitationCode,
      accessByUsernames: [username],
      endpoints: [],
    });
    await projectHistory.save();

    // ─── 10. Queue job (non-blocking) ───────────────────────
    try {
      await projectQueue.add('create', {
        action: 'create',
        projectId: generatedCustomId,
      });
    } catch (queueErr) {
      console.warn('[create-project] projectQueue warning:', queueErr.message);
    }

    // ─── 11. Broadcast Real-Time Socket Event & Invalidate Redis Cache ──
    try {
      const client = await connectRedis();
      if (client && client.isOpen) {
        await client.del(`user:projects:${username}`);
        await client.del(`user_apis:${username}`);
      }
    } catch (_) {}

    if (req.io) {
      req.io.to(`user_${username}`).emit('project_created', {
        project: savedProject,
      });
    }

    // ─── 12. Success ────────────────────────────────────────
    return res.status(201).json({
      success: true,
      invitationCode: invitationCode,
      project: savedProject,
      id: savedProject.id,
      projectname: savedProject.projectname,
    });
  } catch (error) {
    // Rollback atomic increment on any error
    try {
      await User.updateOne({ username, noofProjects: { $gt: 0 } }, { $inc: { noofProjects: -1 } });
    } catch (_) {}

    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflict detected. Please try again.' });
    }
    console.error('Project creation error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to create project' });
  }
}

module.exports = create_project;