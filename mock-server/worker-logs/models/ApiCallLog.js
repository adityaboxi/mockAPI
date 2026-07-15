// worker-logs/models/ApiCallLog.js
const mongoose = require('mongoose');

const apiCallLogSchema = new mongoose.Schema({
  project_id: { type: String, required: true, index: true },
  path:       { type: String, default: '' },
  method:     { type: String, default: '' },
  timestamp:  { type: Date, default: Date.now, index: true },
  cache:      { type: String, default: '' },
  ip:         { type: String, default: '' },
  status:     { type: Number, default: 0 },
  latency_ms: { type: Number, default: 0 },
  private:    { type: Boolean, default: false },
  ttl:        { type: Number, default: 0 },

  // ✅ NEW fields from your worker
  username:       { type: String, index: true },    // extracted from project_id
  team_latency:   { type: Number, default: 0 },    // average team latency from Redis
  user_latency:   { type: Number, default: 0 },    // individual user latency from Redis
}, { timestamps: false });

// Compound index for faster dashboard queries
apiCallLogSchema.index({ project_id: 1, path: 1, method: 1, timestamp: -1 });

// TTL index: auto‑delete logs older than 30 days
apiCallLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('ApiCallLog', apiCallLogSchema);