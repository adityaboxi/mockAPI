const mongoose = require('mongoose');

const projectLatencySchema = new mongoose.Schema({
  project_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  averageRtt: {
    type: Number,
    default: 0
  },
  sampleCount: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ProjectLatency', projectLatencySchema);