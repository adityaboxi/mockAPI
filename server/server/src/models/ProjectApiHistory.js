const mongoose = require('mongoose');

// Version Sub-Schema (stores all configuration for a single API version)
const versionSubSchema = new mongoose.Schema({
  // Basic routing
  protocol: {
    type: String,
    enum: ['http', 'https', 'ws', 'wss'],
    default: 'https',
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    required: true,
  },
  urlPath: {
    type: String,
    required: true,
  },
  pathParams: [{
    key: { type: String },
    value: { type: String },
    _id: false,
  }],
  queryParams: [{
    key: { type: String },
    value: { type: String },
    _id: false,
  }],

  // Request/Response bodies (JSON schemas or example values)
  requestBody: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  responseBody: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  // Versioning and URL
  version: {
    type: String,
    required: true,
    trim: true,
  },
  actualFullUrl: {
    type: String,
    trim: true,
  },
  airesponse: {
    type: Boolean,
    default: false,
  },

  // ========== FIELDS for auth, headers, cookies, latency, rate limit ==========
  isAuthEnabled: {
    type: Boolean,
    default: false,
  },
  authScheme: {
    type: String,
    default: 'BearerAuth',
    enum: ['BearerAuth', 'ApiKeyAuth'],
  },
  latency: {
    type: Number,
    default: 0,
  },
  rateLimit: {
    type: Number,
    default: 0,
  },
  statusCode: {
    type: Number,
    default: 200,
    min: 100,
    max: 599
  },
  // Request headers
  headers: [{
    key: { type: String },
    value: { type: String },
    _id: false,
  }],
  // Response headers
  responseHeaders: [{
    key: { type: String },
    value: { type: String },
    _id: false,
  }],
  // Cookies – extended to include options
  cookies: [{
    key: { type: String },
    value: { type: String },
    options: {
      httpOnly: { type: Boolean, default: false },
      secure: { type: Boolean, default: false },
      sameSite: { type: String, enum: ['Strict', 'Lax', 'None'], default: 'Lax' },
      maxAge: { type: Number },
      domain: { type: String },
      path: { type: String, default: '/' }
    },
    _id: false,
  }],
  // ✨ NEW: Expected authentication tokens
  expectedToken: { type: String, default: '' },
  expectedApiKey: { type: String, default: '' },
}, {
  timestamps: true,
  _id: true,
});

// Endpoint Sub-Schema (unchanged)
const endpointSubSchema = new mongoose.Schema({
  baseUrlPath: {
    type: String,
    required: true,
  },
  versions: [versionSubSchema],
  accessBy: [{
    type: String,
    trim: true,
  }],
}, {
  timestamps: true,
  _id: true
});

// Main Project API History Schema (unchanged)
const projectApiHistorySchema = new mongoose.Schema({
  projectID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  projectCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  accessByUsernames: [{
    type: String,
    trim: true
  }],
  endpoints: [endpointSubSchema],
}, {
  timestamps: true
});

projectApiHistorySchema.index({ "projectID": 1, "endpoints.baseUrlPath": 1 });

module.exports = mongoose.model('ProjectApiHistory', projectApiHistorySchema, 'ProjectApiHistory');