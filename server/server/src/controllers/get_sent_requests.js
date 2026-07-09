const RequestJoinProject = require('../models/RequestJoinProject');
const Project = require('../models/Project');

async function get_sent_requests(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const sentRequests = await RequestJoinProject.find({ 
      requestuser: username,
      isreqaccepted: false 
    }).sort({ createdAt: -1 });

    const enrichedRequests = await Promise.all(sentRequests.map(async (request) => {
      const project = await Project.findOne({ invitationCode: request.invitationCode });
      return {
        id: request._id,
        projectCode: request.invitationCode,
        projectName: project?.projectname || 'Unknown Project',
        status: 'pending',
        requestedTo: request.responseuser,
        createdAt: request.createdAt
      };
    }));
    
    return res.json(enrichedRequests);
  } catch (error) {
    console.error("Error fetching sent requests:", error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
}

module.exports = get_sent_requests;