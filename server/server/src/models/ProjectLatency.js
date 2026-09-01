// models/ProjectLatency.js
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const projectLatencySchema = new mongoose.Schema({
  project_id: { type: String, required: true, unique: true },
  averageRtt: { type: Number, default: 0 },
  sampleCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ProjectLatency', projectLatencySchema);