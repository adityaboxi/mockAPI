require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const apiCallLogSchema = new mongoose.Schema(
  {
    project_id: { type: String, required: true, index: true },
    path: { type: String, default: '' },
    method: { type: String, default: 'GET' },
    timestamp: { type: Date, default: Date.now },
    cache: { type: String, default: 'MISS' },
    ip: { type: String, default: '' },
    status: { type: Number, default: 200 },
    latency_ms: { type: Number, default: 0 },
    private: { type: Boolean, default: false },
    ttl: { type: Number, default: 0 },
    username: { type: String, index: true },
    team_latency: { type: Number, default: 0 },
    user_latency: { type: Number, default: 0 },
    total_latency: { type: Number, default: 0 },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// High-Speed Aggregation Indexes
apiCallLogSchema.index({ project_id: 1, timestamp: -1, total_latency: 1, status: 1 });
apiCallLogSchema.index({ project_id: 1, path: 1, method: 1, timestamp: -1 });

// TTL index: 30 days retention
apiCallLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports =
  mongoose.models.ApiCallLog ||
  mongoose.model('ApiCallLog', apiCallLogSchema);