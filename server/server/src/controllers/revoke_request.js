const RequestJoinProject = require('../models/RequestJoinProject');

async function revoke_request(req, res) {
  const { requestId } = req.params;
  const username = req.user?.username;
  const role = req.user?.role;

  if (!username || role === 'guest') {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const request = await RequestJoinProject.findById(requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.requestuser !== username && role !== 'admin') {
      return res.status(403).json({ error: "You can only revoke your own requests" });
    }
    if (request.isreqaccepted) {
      return res.status(400).json({ error: "Cannot revoke an already accepted request" });
    }

    const managerUsername = request.responseuser;
    await RequestJoinProject.deleteOne({ _id: requestId });

    if (req.io) {
      req.io.to(`user_${managerUsername}`).emit('join_request_revoked', {
        requestId: request._id.toString(),
      });
    }

    return res.json({ success: true, message: "Request revoked successfully" });
  } catch (error) {
    console.error("Error revoking request:", error);
    return res.status(500).json({ error: "Failed to revoke request" });
  }
}

module.exports = revoke_request;


/*
const RequestJoinProject = require('../models/RequestJoinProject');
const { internalRedis } = require('../config/redis');

async function revoke_request(req, res) {
  const { requestId } = req.params;
  const { username, role } = req.user; // guaranteed by auth middleware

  if (role === 'guest') {
    return res.status(403).json({ error: 'Guests cannot revoke requests' });
  }

  try {
    const request = await RequestJoinProject.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.requestuser !== username && role !== 'admin') {
      return res.status(403).json({ error: 'You can only revoke your own requests' });
    }
    if (request.isreqaccepted) {
      return res.status(400).json({ error: 'Cannot revoke an already accepted request' });
    }

    const managerUsername = request.responseuser;
    await RequestJoinProject.deleteOne({ _id: requestId });

    // ---- Invalidate caches for both users ----
    const usersToInvalidate = [username, managerUsername];
    for (const user of usersToInvalidate) {
      const pattern = `cache:${user}:*`;
      try {
        const keys = await internalRedis.keys(pattern);
        if (keys.length) {
          await internalRedis.del(keys);
        }
      } catch (err) {
        // Redis error – ignore
      }
    }

    if (req.io) {
      req.io.to(`user_${managerUsername}`).emit('join_request_revoked', {
        requestId: request._id.toString(),
      });
    }

    return res.json({ success: true, message: 'Request revoked successfully' });
  } catch (error) {
    console.error('[revoke-request] Error:', error);
    return res.status(500).json({ error: 'Failed to revoke request' });
  }
}

module.exports = revoke_request;*/