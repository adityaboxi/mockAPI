require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const SystemEventLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    method: {
      type: String,
      required: true,
      default: 'GET',
    },
    url: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g. "created", "updated", "deleted"
    },
    version: {
      type: String,
      default: 'v1',
      index: true,
    },
    username: {
      type: String,
      required: true,
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

// High-Speed Compound Indexes
SystemEventLogSchema.index({ projectId: 1, createdAt: -1 });
SystemEventLogSchema.index({ accessByUsername: 1, createdAt: -1 });

// Automatic 60-Day TTL Purge
SystemEventLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5184000 });

module.exports =
  mongoose.models.SystemEventLog ||
  mongoose.model('SystemEventLog', SystemEventLogSchema);