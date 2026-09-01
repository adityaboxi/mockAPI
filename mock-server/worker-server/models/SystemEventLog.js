// models/SystemEventLog.js
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const SystemEventLogSchema = new mongoose.Schema({
  projectId: { type: String, required: true },
  username: { type: String, required: true },
  action: { type: String, required: true }, // e.g., 'created', 'updated', 'deleted'
  method: { type: String },
  url: { type: String },
  version: { type: String },
  accessByUsername: { type: [String], default: [] },
  statusCode: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemEventLog', SystemEventLogSchema);