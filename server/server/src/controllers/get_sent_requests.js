
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const RequestJoinProject = require('../models/RequestJoinProject');
const Project = require('../models/Project');

async function get_sent_requests(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const sentRequests = await RequestJoinProject.find({
      requestuser: username,
      isreqaccepted: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!sentRequests.length) {
      return res.json([]);
    }

    const invitationCodes = [...new Set(sentRequests.map((r) => r.invitationCode).filter(Boolean))];
    const projects = await Project.find({ invitationCode: { $in: invitationCodes } })
      .select('id projectname invitationCode')
      .lean();

    const projectMap = new Map();
    projects.forEach((p) => projectMap.set(p.invitationCode, p));

    const enrichedRequests = sentRequests.map((request) => {
      const project = projectMap.get(request.invitationCode);
      return {
        id: request._id,
        projectCode: request.invitationCode,
        projectName: project?.projectname || 'Unknown Project',
        status: 'pending',
        requestedTo: request.responseuser,
        createdAt: request.createdAt,
      };
    });

    return res.json(enrichedRequests);
  } catch (error) {
    console.error('Error fetching sent requests:', error.message);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
}

module.exports = get_sent_requests;