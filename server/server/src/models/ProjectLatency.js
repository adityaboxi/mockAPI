require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const projectLatencySchema = new mongoose.Schema(
  {
    project_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    averageRtt: {
      type: Number,
      default: 0,
    },
    sampleCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports =
  mongoose.models.ProjectLatency ||
  mongoose.model('ProjectLatency', projectLatencySchema);