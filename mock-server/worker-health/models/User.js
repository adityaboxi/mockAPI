require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      lowercase: true,
      index: true,
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true, 
      lowercase: true,
      index: true,
    },
    password: { 
      type: String, 
      required: true, 
    },
    name: { 
      type: String, 
      required: true, 
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'guest', 'admin', 'team_lead'],
      default: 'user',
      index: true,
    },
    subscribe: {
      type: Boolean,
      default: false,
    },
    latency: {
      type: Number,
      default: 0,
    },
  }, 
  { 
    timestamps: true,   // Automatically manages createdAt & updatedAt
    versionKey: false,  // Disables __v overhead
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password; // Never expose password hash in JSON output
        return ret;
      },
    },
  }
);

// ==================== PRE-SAVE HOOK ====================

// Hash password before saving – fallback to 10 rounds if env var missing
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;

  // Guard against re-hashing already hashed passwords
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return;
  }

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
});

// ==================== METHODS & STATICS ====================

// Compare password
userSchema.methods.comparePassword = async function(enteredPassword) {
  if (!enteredPassword || !this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Safe user session lookup (strips password)
userSchema.statics.findSafeById = async function(userId) {
  return await this.findById(userId).select('-password').lean();
};

// Fast user lookup by username or email for login
userSchema.statics.findByUsernameOrEmail = async function(identifier) {
  if (!identifier) return null;
  const cleanId = String(identifier).trim().toLowerCase();
  return await this.findOne({
    $or: [{ username: cleanId }, { email: cleanId }],
  });
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);