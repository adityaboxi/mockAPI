require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const Project = require('../models/Project');

/**
 * POST /api/unsubscribeproject
 * Sets the authenticated user's `subscribe` to false.
 * Optionally sets a specific project's `issubdcribe` to false if `projectId` is provided.
 *
 * Expects: { projectId?: string } in req.body
 * Authentication: JWT (via authenticateToken middleware)
 */
const unsubscribeProject = async (req, res) => {
  try {
    const username = req.user?.username;
    if (!username) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { projectId } = req.body; // optional

    // ─── 1. Update user subscription ──────────────────────
    const updatedUser = await User.findOneAndUpdate(
      { username },
      { $set: { subscribe: false } },
      { new: true, select: 'username subscribe noofProjects' }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ─── 2. If projectId provided, update that project ──
    let updatedProject = null;
    if (projectId) {
      updatedProject = await Project.findOneAndUpdate(
        { id: projectId },
        { $set: { issubdcribe: false } },
        { new: true, select: 'id projectname issubdcribe' }
      );
      if (!updatedProject) {
        console.warn(`[Unsubscribe] Project ${projectId} not found for subscription update.`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Unsubscription successful',
      user: updatedUser,
      project: updatedProject || undefined,
    });

  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = unsubscribeProject;