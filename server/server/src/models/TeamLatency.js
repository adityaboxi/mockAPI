require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const teamLatencySchema = new mongoose.Schema(
  {
    project_id: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
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

teamLatencySchema.index({ project_id: 1, username: 1 }, { unique: true });
teamLatencySchema.index({ project_id: 1 });

module.exports =
  mongoose.models.TeamLatency ||
  mongoose.model('TeamLatency', teamLatencySchema);