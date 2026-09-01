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
      default: 'DoS attack – exceeded rate limit on private endpoints',
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

    // Unblocking metadata
    unblockedAt: { 
      type: Date,
    },
    unblockReason: { 
      type: String,
      trim: true,
    },
    unblockedBy: { 
      type: String,
      trim: true,
    },

    // Contextual request details
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
      default: true,
    },
  }, 
  { 
    timestamps: true,    // Adds createdAt & updatedAt automatically
    versionKey: false,   // Eliminates __v BSON overhead
  }
);

// ==================== HIGH-PERFORMANCE INDEXES ====================

// 1. Core security gate check (fastest lookup for active IP bans)
blockedIPSchema.index({ project_id: 1, ip: 1, expiresAt: -1 });

// 2. Project-wide blocked list overview
blockedIPSchema.index({ project_id: 1, expiresAt: -1 });

// 3. TTL Auto-Purge: MongoDB automatically removes expired bans at exact expiry time
blockedIPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 4. Audit timeline index
blockedIPSchema.index({ blockedAt: -1, expiresAt: -1 });

module.exports = mongoose.models.BlockedIP || mongoose.model('BlockedIP', blockedIPSchema);