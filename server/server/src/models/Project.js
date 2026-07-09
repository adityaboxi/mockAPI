const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  projectname: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  invitationCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  members: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static method to check if invitation code is unique
projectSchema.statics.isInvitationCodeUnique = async function(code) {
  const existing = await this.findOne({ invitationCode: code });
  return !existing;
};

// Static method to find project by invitation code
projectSchema.statics.findByInvitationCode = async function(code) {
  return await this.findOne({ invitationCode: code });
};

// Instance method to update invitation code
projectSchema.methods.updateInvitationCode = async function(newCode) {
  this.invitationCode = newCode;
  this.updatedAt = Date.now();
  return await this.save();
};

module.exports = mongoose.model('Project', projectSchema);