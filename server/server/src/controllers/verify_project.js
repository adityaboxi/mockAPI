const Project = require('../models/Project');

async function verify_project(req, res) {
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
    }

    try {
        console.log('🔵 Verification request received:', { projectId });

        // Query using the custom string 'id' field
        const project = await Project.findOne({
            id: projectId,
            isActive: true,
        });

        if (!project) {
            return res.status(403).json({ error: 'Invalid project' });
        }

        const hasAccess =
            project.username === req.user.username ||
            (project.members && project.members.includes(req.user.username)) ||
            req.user.role === 'admin';

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied – you are not a member of this project' });
        }

        return res.json({
            valid: true,
            project: {
                id: project.id,
                name: project.projectname,
                invitationCode: project.invitationCode,
            },
        });
    } catch (error) {
        console.error('Project verification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = verify_project;