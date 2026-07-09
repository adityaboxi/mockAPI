const mongoose = require('mongoose');

const SystemEventLogSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'SYSTEM']
  },
  url: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true // e.g., "created", "updated", "deleted"
  },
 version: { type: String, index: true },
  username: {
    type: String,
    required: true // The person who performed the action
  },
  accessByUsername: {
    type: [String],
    default: []
  },
  statusCode: {
    type: Number,
    default: 200
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

module.exports = mongoose.model('SystemEventLog', SystemEventLogSchema);