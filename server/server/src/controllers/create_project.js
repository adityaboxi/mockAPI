require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const Project = require('../models/Project');
const ProjectApiHistory = require('../models/ProjectApiHistory');
const User = require('../models/User');                 // <-- Added
const { redisClient } = require('../config/redis');
const projectQueue = require('../queues/projectQueue');

const CODE_LENGTH = parseInt(process.env.INVITATION_CODE_LENGTH, 10);
const MAX_ATTEMPTS = parseInt(process.env.INVITATION_MAX_ATTEMPTS, 10);
const INVITATION_RESERVE_TTL = parseInt(process.env.INVITATION_RESERVE_TTL, 10);
const CHARSET = process.env.INVITATION_CHARSET;

// ─── Helper: generate unique invitation code ──────────────
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

// ─── Main controller ──────────────────────────────────────────
async function create_project(req, res) {
  const { projectname } = req.body;
  const username = req.user?.username;
  const role = req.user?.role;   // from token (optional, but kept for fallback)

  // ─── 1. Basic validation ─────────────────────────────────
  if (!username || !projectname || !projectname.trim()) {
    return res.status(400).json({ error: "Valid username and project name are required" });
  }

  try {
    // ─── 2. Fetch user from DB (latest data) ───────────────
    const user = await User.findOne({ username })
      .select('role subscribe noofProjects')   // only needed fields
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Guest check (using DB role for consistency)
    if (user.role === 'guest') {
      return res.status(403).json({ error: "Guest users cannot create projects" });
    }

    // ─── 3. Determine project limit ─────────────────────────
    const maxProjects = user.subscribe ? 5 : 2;

    // ─── 4. Atomic check + increment (race‑condition safe) ──
    const updatedUser = await User.findOneAndUpdate(
      {
        username,
        noofProjects: { $lt: maxProjects }   // only if under limit
      },
      {
        $inc: { noofProjects: 1 }
      },
      {
        new: true,
        select: 'noofProjects'
      }
    );

    if (!updatedUser) {
      return res.status(403).json({
        error: `You have reached the maximum of ${maxProjects} projects. ${user.subscribe ? 'Please upgrade your plan.' : 'Upgrade to create more.'}`
      });
    }

    // ─── 5. Duplicate check ─────────────────────────────────
    const trimmedProjectName = projectname.trim();
    const generatedCustomId = `${username}_${trimmedProjectName.replace(/\s+/g, '_')}`;
    const duplicateCheck = await Project.findOne({ id: generatedCustomId });
    if (duplicateCheck) {
      // Rollback the increment – project creation is aborted
      await User.updateOne({ username }, { $inc: { noofProjects: -1 } });
      return res.status(400).json({ error: "You already have a workspace with this name" });
    }

    // ─── 6. Generate invitation code ──────────────────────
    const invitationCode = await generateUniqueInvitationCode();

    // ─── 7. Build project object ────────────────────────────
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

    // ─── 8. Save project ────────────────────────────────────
    const savedProject = await Project.create(newProject);

    // ─── 9. Create project history ──────────────────────────
    const projectHistory = new ProjectApiHistory({
      projectID: generatedCustomId,
      projectCode: invitationCode,
      accessByUsernames: [username],
      endpoints: []
    });
    await projectHistory.save();

    // ─── 10. Queue job ──────────────────────────────────────
    await projectQueue.add('create', {
      action: 'create',
      projectId: generatedCustomId,
    });

    // ─── 11. Success ────────────────────────────────────────
    return res.status(201).json({
      success: true,
      invitationCode: invitationCode,
      project: savedProject
    });

  } catch (error) {
    // Handle duplicate key errors (rare but safe)
    if (error.code === 11000) {
      // Attempt to rollback the increment (if we incremented before error)
      try {
        await User.updateOne({ username }, { $inc: { noofProjects: -1 } });
      } catch (_) { /* ignore rollback errors */ }
      return res.status(409).json({ error: "Conflict detected. Please try again." });
    }
    console.error("Project creation error:", error);
    return res.status(500).json({ error: "Failed to create project" });
  }
}

module.exports = create_project;