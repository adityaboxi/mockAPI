const mongoose = require('mongoose');

const teamLatencySchema = new mongoose.Schema({
  project_id: { type: String, required: true, index: true },
  username: { type: String, required: true, index: true },
  averageRtt: { type: Number, default: 0 },
  sampleCount: { type: Number, default: 0 },
  // Remove `updatedAt` – Mongoose will manage it via `timestamps: true`
}, { 
  timestamps: true, // auto‑adds createdAt & updatedAt
});

// Unique compound index (one record per user per project)
teamLatencySchema.index({ project_id: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('TeamLatency', teamLatencySchema);