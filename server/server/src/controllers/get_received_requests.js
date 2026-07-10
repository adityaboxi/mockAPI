/*const RequestJoinProject = require('../models/RequestJoinProject');
const Project = require('../models/Project');

async function get_received_requests(req, res) {
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const pendingRequests = await RequestJoinProject.find({ 
      responseuser: username,
      isreqaccepted: false 
    }).sort({ createdAt: -1 });

    const enrichedRequests = await Promise.all(pendingRequests.map(async (request) => {
      const project = await Project.findOne({ invitationCode: request.invitationCode });
      return {
        _id: request._id,
        id: request._id,
        projectName: project?.projectname || 'Unknown Project',
        projectId: project?.id || project?._id,
        requestedBy: request.requestuser,
        invitationCode: request.invitationCode,
        createdAt: request.createdAt
      };
    }));
    
    return res.json(enrichedRequests);
  } catch (error) {
    console.error("Error fetching received requests:", error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
}

module.exports = get_received_requests;*/


const RequestJoinProject = require('../models/RequestJoinProject');
const Project = require('../models/Project');
const { internalRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

async function get_received_requests(req, res) {
  const username = req.user.username; // guaranteed by auth middleware

  const cacheKey = `cache:${username}:received_requests`;

  try {
    // 1. Try to serve from Redis cache
    const cached = await internalRedis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return res.status(200).json(data);
    }
  } catch (err) {
    // Redis error – fall through to database
  }

  try {
    const pendingRequests = await RequestJoinProject.find({
      responseuser: username,
      isreqaccepted: false
    }).sort({ createdAt: -1 });

    const enrichedRequests = await Promise.all(pendingRequests.map(async (request) => {
      const project = await Project.findOne({ invitationCode: request.invitationCode });
      return {
        _id: request._id,
        id: request._id,
        projectName: project?.projectname || 'Unknown Project',
        projectId: project?.id || project?._id,
        requestedBy: request.requestuser,
        invitationCode: request.invitationCode,
        createdAt: request.createdAt
      };
    }));

    // 2. Store in Redis cache
    try {
      await internalRedis.setex(cacheKey, CACHE_TTL, JSON.stringify(enrichedRequests));
    } catch (err) {
      // Cache set failed – no problem
    }

    return res.json(enrichedRequests);
  } catch (error) {
    console.error("[get-received-requests] Error:", error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
}

module.exports = get_received_requests;