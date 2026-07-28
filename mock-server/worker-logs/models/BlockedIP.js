require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const blockedIPSchema = new mongoose.Schema({
  project_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  ip: { 
    type: String, 
    required: true, 
    index: true 
  },

  reason: { 
    type: String, 
    default: 'DoS attack – exceeded 100 private requests/sec' 
  },

  blockedAt: { 
    type: Date, 
    default: Date.now 
  },

  expiresAt: { 
    type: Date, 
    required: true,
    index: true 
  },

  // Unblocking info
  unblockedAt: { 
    type: Date 
  },
  unblockReason: { 
    type: String 
  },

  // Request context
  requestPath: { 
    type: String, 
    default: '' 
  },
  requestMethod: { 
    type: String, 
    default: 'GET',
    uppercase: true 
  },

  isPrivate: { 
    type: Boolean, 
    default: true 
  },

  // Optional: who unblocked it
  unblockedBy: { 
    type: String 
  },

}, { 
  timestamps: true   // Keeps createdAt / updatedAt
});

// ==================== INDEXES ====================

// Fast lookup for active blocks
blockedIPSchema.index({ project_id: 1, ip: 1, expiresAt: 1 });

// Query active blocks
blockedIPSchema.index({ expiresAt: 1 });

// By project + active blocks
blockedIPSchema.index({ project_id: 1, expiresAt: { $gt: new Date() } });

// Compound for cleanup queries
blockedIPSchema.index({ blockedAt: 1, expiresAt: 1 });

module.exports = mongoose.model('BlockedIP', blockedIPSchema);