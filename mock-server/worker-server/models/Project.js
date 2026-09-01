require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    projectname: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    invitationCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    members: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ---------- Compound & Multikey Indexes for 10,000+ Scale ----------
// Fast lookups for user and collaborator projects
projectSchema.index({ username: 1, isActive: 1 });
projectSchema.index({ members: 1, isActive: 1 });
projectSchema.index({ id: 1, isActive: 1 });

// ---------- Static & Instance Helpers ----------
projectSchema.statics.isInvitationCodeUnique = async function (code) {
  if (!code) return false;
  const existing = await this.exists({ invitationCode: code.toUpperCase().trim() });
  return !existing;
};

projectSchema.statics.findByInvitationCode = async function (code) {
  if (!code) return null;
  return this.findOne({ invitationCode: code.toUpperCase().trim() });
};

projectSchema.methods.updateInvitationCode = async function (newCode) {
  this.invitationCode = newCode.toUpperCase().trim();
  return this.save();
};

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);