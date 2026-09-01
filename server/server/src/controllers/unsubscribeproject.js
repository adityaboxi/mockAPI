require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const User = require('../models/User');
const Project = require('../models/Project');
const { connectRedis } = require('../config/redis');

const unsubscribeProject = async (req, res) => {
  try {
    const username = req.user?.username;
    if (!username) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { projectId } = req.body;

    const updatedUser = await User.findOneAndUpdate(
      { username },
      { $set: { subscribe: false } },
      { new: true, select: 'username subscribe noofProjects' }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    let updatedProject = null;
    if (projectId) {
      updatedProject = await Project.findOneAndUpdate(
        { id: projectId },
        { $set: { issubdcribe: false } },
        { new: true, select: 'id projectname issubdcribe' }
      );
    }

    try {
      const client = await connectRedis();
      await client.del(`user:projects:${username}`);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Unsubscription successful',
      user: updatedUser,
      project: updatedProject || undefined,
    });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

module.exports = unsubscribeProject;