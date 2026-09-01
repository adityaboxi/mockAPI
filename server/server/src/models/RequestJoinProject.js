require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const RequestJoinProjectSchema = new mongoose.Schema(
  {
    invitationCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    requestuser: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    responseuser: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isreqaccepted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound unique index to prevent duplicate pending requests
RequestJoinProjectSchema.index({ invitationCode: 1, requestuser: 1 }, { unique: true });
RequestJoinProjectSchema.index({ responseuser: 1, isreqaccepted: 1, createdAt: -1 });

// Check if user has a pending request for a project
RequestJoinProjectSchema.statics.hasPendingRequest = async function (requestUsername, code) {
  const existing = await this.findOne({
    requestuser: requestUsername,
    invitationCode: code,
    isreqaccepted: false,
  }).lean();
  return !!existing;
};

// Find all pending requests for a project owner
RequestJoinProjectSchema.statics.findPendingRequestsForOwner = async function (ownerUsername) {
  return this.find({
    responseuser: ownerUsername,
    isreqaccepted: false,
  })
    .sort({ createdAt: -1 })
    .lean();
};

module.exports =
  mongoose.models.RequestJoinProject ||
  mongoose.model('RequestJoinProject', RequestJoinProjectSchema);