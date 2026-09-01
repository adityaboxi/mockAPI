require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const teamLatencySchema = new mongoose.Schema(
  {
    project_id: { 
      type: String, 
      required: true, 
      trim: true,
      index: true,
    },
    
    username: { 
      type: String, 
      required: true, 
      trim: true,
      index: true,
    },

    averageRtt: { 
      type: Number, 
      default: 0,
      min: 0,
    },

    sampleCount: { 
      type: Number, 
      default: 0,
      min: 0,
    },

    lastUpdated: { 
      type: Date, 
      default: Date.now,
    },
  }, 
  { 
    timestamps: true,   // Automatically manages createdAt & updatedAt
    versionKey: false,  // Disables __v to save BSON size
  }
);

// ==================== HIGH-PERFORMANCE INDEXES ====================

// 1. Primary Unique Compound Index (Strictly one record per user per workspace)
teamLatencySchema.index({ project_id: 1, username: 1 }, { unique: true });

// 2. Fast team ranking / timeline query
teamLatencySchema.index({ project_id: 1, updatedAt: -1 });

// 3. TTL Auto-Purge: Auto-delete inactive latency records after 90 days of no updates
teamLatencySchema.index({ updatedAt: 1 }, { 
  expireAfterSeconds: 90 * 24 * 3600,
});

// ==================== ATOMIC HELPERS ====================

/**
 * Record a new round-trip time (RTT) sample with rolling average calculation
 */
teamLatencySchema.statics.recordSample = async function(project_id, username, rtt) {
  if (!project_id || !username || rtt == null) return null;
  const sample = Math.max(0, Number(rtt));

  const existing = await this.findOne({ project_id, username });
  if (!existing) {
    return await this.create({
      project_id,
      username,
      averageRtt: sample,
      sampleCount: 1,
      lastUpdated: new Date(),
    });
  }

  const oldAvg = existing.averageRtt || 0;
  const oldCount = existing.sampleCount || 1;
  const newCount = oldCount + 1;
  const newAvg = Math.round((oldAvg * oldCount + sample) / newCount);

  existing.averageRtt = newAvg;
  existing.sampleCount = newCount;
  existing.lastUpdated = new Date();
  return await existing.save();
};

module.exports = mongoose.models.TeamLatency || mongoose.model('TeamLatency', teamLatencySchema);