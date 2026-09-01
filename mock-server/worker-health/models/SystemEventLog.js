require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const SystemEventLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'SYSTEM', 'imported'],
      uppercase: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true, // e.g., "created", "updated", "deleted", "imported"
      trim: true,
    },
    version: { 
      type: String, 
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true, // Person who performed the action
      trim: true,
      index: true,
    },
    accessByUsername: [
      {
        type: String,
        trim: true,
      }
    ],
    statusCode: {
      type: Number,
      default: 200,
    },
  }, 
  {
    timestamps: true,   // Automatically adds createdAt & updatedAt
    versionKey: false,  // Disables __v to save BSON size
  }
);

// ==================== HIGH-PERFORMANCE INDEXES ====================

// 1. Primary workspace activity timeline query
SystemEventLogSchema.index({ projectId: 1, createdAt: -1 });

// 2. Multikey index for team-wide audit feeds
SystemEventLogSchema.index({ accessByUsername: 1, createdAt: -1 });

// 3. User audit timeline
SystemEventLogSchema.index({ username: 1, createdAt: -1 });

// 4. TTL Auto-Purge: Auto-delete system events older than 60 days
SystemEventLogSchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 60 * 24 * 3600,
});

module.exports = mongoose.models.SystemEventLog || mongoose.model('SystemEventLog', SystemEventLogSchema);