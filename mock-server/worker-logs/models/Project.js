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
      }
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,   // Automatically manages createdAt (Date) & updatedAt (Date)
    versionKey: false,  // Disables __v overhead for scale
  }
);

// ==================== HIGH-PERFORMANCE INDEXES ====================

// 1. Dashboard query: fetch user's active owned projects sorted by newest
projectSchema.index({ username: 1, isActive: 1, createdAt: -1 });

// 2. Multikey index: fetch projects where user is a team member
projectSchema.index({ members: 1, isActive: 1 });

// ==================== STATICS & METHODS ====================

// Check if invitation code is unique
projectSchema.statics.isInvitationCodeUnique = async function(code) {
  if (!code) return false;
  const existing = await this.findOne({ invitationCode: String(code).trim().toUpperCase() }).select('_id').lean();
  return !existing;
};

// Find project by invitation code with lean projection support
projectSchema.statics.findByInvitationCode = async function(code) {
  if (!code) return null;
  return await this.findOne({ invitationCode: String(code).trim().toUpperCase() });
};

// Verify user permission (owner or team member) efficiently
projectSchema.statics.findAccessibleProject = async function(projectId, username) {
  return await this.findOne({
    id: projectId,
    $or: [
      { username: username },
      { members: username },
    ],
  });
};

// Instance method to update invitation code
projectSchema.methods.updateInvitationCode = async function(newCode) {
  this.invitationCode = String(newCode).trim().toUpperCase();
  this.updatedAt = new Date();
  return await this.save();
};

// Instance method to check if user has access
projectSchema.methods.isMemberOrOwner = function(username) {
  if (!username) return false;
  return this.username === username || (this.members && this.members.includes(username));
};

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);