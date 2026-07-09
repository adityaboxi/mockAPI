const Project = require('../models/Project');

async function projects(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (role === 'guest') {
    return res.status(400).json({ error: "Valid username is required" });
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: "Valid username is required" });
  }

  try {
    const userProjects = await Project.find({
      $or: [
        { username: username },
        { members: { $in: [username] } }
      ]
    })
    .select('id projectname username invitationCode members createdAt isActive')
    .sort({ createdAt: -1, projectname: 1 })
    .lean();

    const transformedProjects = userProjects.map(project => {
      const isCreator = project.username === username;
      
      return {
        id: project.id,
        projectname: project.projectname,
        username: project.username,
        invitationCode: isCreator ? project.invitationCode : null,
        members: project.members,
        createdAt: project.createdAt,
        isActive: project.isActive !== undefined ? project.isActive : true,
        isCreator: isCreator
      };
    });

    res.json(transformedProjects);
  } catch (error) {
    console.error("Fetch projects error:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
}

module.exports = projects;