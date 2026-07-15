// server/server/src/models/BlockedIP.js
const mongoose = require('mongoose');

const blockedIPSchema = new mongoose.Schema({
  project_id: { type: String, required: true, index: true },
  ip: { type: String, required: true, index: true },
  reason: { type: String, default: 'DoS attack - exceeded 100 req/sec' },
  blockedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  unblockedAt: { type: Date },
  unblockReason: { type: String },
  requestPath: { type: String, default: '' },
  requestMethod: { type: String, default: 'GET' },
  isPrivate: { type: Boolean, default: false },
}, { timestamps: true });

blockedIPSchema.index({ project_id: 1, ip: 1, expiresAt: 1 });

module.exports = mongoose.model('BlockedIP', blockedIPSchema);