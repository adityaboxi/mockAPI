const mongoose = require('mongoose');

const apiCallLogSchema = new mongoose.Schema({
  project_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  username: { 
    type: String, 
    index: true 
  }, // extracted from project_id (e.g., "aditya" from "aditya_abc123")

  path: { 
    type: String, 
    default: '' 
  },
  method: { 
    type: String, 
    default: 'GET',
    uppercase: true 
  },

  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },

  // Request details
  ip: { 
    type: String, 
    default: '' 
  },
  status: { 
    type: Number, 
    default: 0 
  },
  latency_ms: { 
    type: Number, 
    default: 0 
  },

  // Latency breakdown (from Redis)
  team_latency: { 
    type: Number, 
    default: 0 
  },
  user_latency: { 
    type: Number, 
    default: 0 
  },
  total_latency: { 
    type: Number, 
    default: 0 
  },

  // Other flags
  private: { 
    type: Boolean, 
    default: false 
  },
  cache: { 
    type: String, 
    default: 'MISS' 
  },
  ttl: { 
    type: Number, 
    default: 0 
  },

}, { 
  timestamps: false   // We already have explicit timestamp
});

// ==================== INDEXES ====================

// Fast dashboard queries
apiCallLogSchema.index({ project_id: 1, timestamp: -1 });
apiCallLogSchema.index({ project_id: 1, path: 1, method: 1, timestamp: -1 });

// Username-based queries
apiCallLogSchema.index({ username: 1, timestamp: -1 });

// TTL: Auto-delete logs older than 30 days
apiCallLogSchema.index({ timestamp: 1 }, { 
  expireAfterSeconds: 30 * 24 * 3600 
});

// Compound index for latency analytics
apiCallLogSchema.index({ project_id: 1, private: 1, timestamp: -1 });

module.exports = mongoose.model('ApiCallLog', apiCallLogSchema);