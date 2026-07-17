const mongoose = require('mongoose');

const teamLatencySchema = new mongoose.Schema({
  project_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  username: { 
    type: String, 
    required: true, 
    index: true 
  },

  averageRtt: { 
    type: Number, 
    default: 0,
    min: 0 
  },

  sampleCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },

  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },

}, { 
  timestamps: true   // Keeps createdAt and updatedAt
});

// ==================== INDEXES ====================

// Unique compound index (one record per user per project)
teamLatencySchema.index({ project_id: 1, username: 1 }, { unique: true });

// Fast queries by project
teamLatencySchema.index({ project_id: 1, updatedAt: -1 });

// For team average calculations
teamLatencySchema.index({ project_id: 1 });

// Optional: TTL for old records (optional - 90 days)
teamLatencySchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 90 * 24 * 3600 
});

module.exports = mongoose.model('TeamLatency', teamLatencySchema);