require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const blockedIPSchema = new mongoose.Schema(
  {
    project_id: { 
      type: String, 
      required: true, 
      trim: true,
      index: true,
    },
    ip: { 
      type: String, 
      required: true, 
      trim: true,
      index: true,
    },
    reason: { 
      type: String, 
      default: 'DoS attack - exceeded rate limit',
      trim: true,
    },
    blockedAt: { 
      type: Date, 
      default: Date.now,
    },
    expiresAt: { 
      type: Date, 
      required: true, 
    },
    unblockedAt: { 
      type: Date,
    },
    unblockReason: { 
      type: String,
      trim: true,
    },
    requestPath: { 
      type: String, 
      default: '',
      trim: true,
    },
    requestMethod: { 
      type: String, 
      default: 'GET',
      uppercase: true,
      trim: true,
    },
    isPrivate: { 
      type: Boolean, 
      default: false,
    },
  }, 
  { 
    timestamps: true,   // Automatically manages createdAt & updatedAt
    versionKey: false,  // Disables __v to save BSON overhead
  }
);

// ==================== HIGH-PERFORMANCE INDEXES ====================

// 1. Primary Security Check (fastest query for active IP block status)
blockedIPSchema.index({ project_id: 1, ip: 1, expiresAt: -1 });

// 2. Project-level blocked IP list overview
blockedIPSchema.index({ project_id: 1, expiresAt: -1 });

// 3. TTL Auto-Purge: MongoDB automatically deletes records once expiresAt date passes
blockedIPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.BlockedIP || mongoose.model('BlockedIP', blockedIPSchema);