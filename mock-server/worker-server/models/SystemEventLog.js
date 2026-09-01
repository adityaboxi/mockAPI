require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const SystemEventLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true, // e.g. 'created', 'updated', 'deleted', 'imported'
    },
    method: {
      type: String,
      uppercase: true,
      default: 'GET',
    },
    url: {
      type: String,
      default: '',
    },
    version: {
      type: String,
      default: 'v1',
    },
    accessByUsername: {
      type: [String],
      default: [],
    },
    statusCode: {
      type: Number,
      default: 200,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ---------- High-Performance Compound & TTL Indexes ----------
// 1. Instant lookups for project event history in dashboard & sockets
SystemEventLogSchema.index({ projectId: 1, createdAt: -1 });

// 2. High-speed collaborator activity lookup
SystemEventLogSchema.index({ accessByUsername: 1, createdAt: -1 });

// 3. Automatic 60-Day TTL Data Cleanup (60 * 24 * 3600 = 5,184,000 seconds)
SystemEventLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5184000 });

module.exports =
  mongoose.models.SystemEventLog ||
  mongoose.model('SystemEventLog', SystemEventLogSchema);