// models/TeamLatency.js
const mongoose = require('mongoose');

const teamLatencySchema = new mongoose.Schema({
  project_id: { type: String, required: true, index: true },
  username: { type: String, required: true, index: true },
  averageRtt: { type: Number, default: 0 },
  sampleCount: { type: Number, default: 0 },
}, { timestamps: true });

teamLatencySchema.index({ project_id: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('TeamLatency', teamLatencySchema);