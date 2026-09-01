require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

// Version Sub-Schema (stores configuration for an individual API version)
const versionSubSchema = new mongoose.Schema(
  {
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
      uppercase: true,
    },
    urlPath: {
      type: String,
      required: true,
      trim: true,
    },
    pathParams: [
      {
        key: { type: String, trim: true },
        value: { type: String },
        _id: false,
      }
    ],
    queryParams: [
      {
        key: { type: String, trim: true },
        value: { type: String },
        required: { type: Boolean, default: false },
        _id: false,
      }
    ],

    // Request/Response bodies
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
      default: 'v1',
    },
    actualFullUrl: {
      type: String,
      trim: true,
    },
    airesponse: {
      type: Boolean,
      default: false,
    },

    // Auth, latency & rate limits
    isAuthEnabled: {
      type: Boolean,
      default: false,
    },
    authScheme: {
      type: String,
      default: 'BearerAuth',
      enum: ['BearerAuth', 'ApiKeyAuth', 'bearer', 'apikey', 'jwt', 'Bearer', 'ApiKey', 'bearerauth', 'apikeyauth'],
    },
    latency: {
      type: Number,
      default: 0,
      min: 0,
    },
    rateLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    statusCode: {
      type: Number,
      default: 200,
      min: 100,
      max: 599,
    },

    // Request & response headers
    headers: [
      {
        key: { type: String, trim: true },
        value: { type: String },
        _id: false,
      }
    ],
    responseHeaders: [
      {
        key: { type: String, trim: true },
        value: { type: String },
        _id: false,
      }
    ],

    // Cookies with options
    cookies: [
      {
        key: { type: String, trim: true },
        value: { type: String },
        options: {
          httpOnly: { type: Boolean, default: false },
          secure: { type: Boolean, default: false },
          sameSite: { type: String, enum: ['Strict', 'Lax', 'None', 'strict', 'lax', 'none'], default: 'Lax' },
          maxAge: { type: Number },
          domain: { type: String, trim: true },
          path: { type: String, default: '/' },
        },
        _id: false,
      }
    ],

    // Expected authentication tokens
    expectedToken: { type: String, default: '', trim: true },
    expectedApiKey: { type: String, default: '', trim: true },
    summary: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
  }, 
  {
    timestamps: true,
    versionKey: false,
    _id: true,
  }
);

// Endpoint Sub-Schema
const endpointSubSchema = new mongoose.Schema(
  {
    baseUrlPath: {
      type: String,
      required: true,
      trim: true,
    },
    versions: [versionSubSchema],
    accessBy: [
      {
        type: String,
        trim: true,
      }
    ],
  }, 
  {
    timestamps: true,
    versionKey: false,
    _id: true,
  }
);

// Main Project API History Schema
const projectApiHistorySchema = new mongoose.Schema(
  {
    projectID: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    projectCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    accessByUsernames: [
      {
        type: String,
        trim: true,
      }
    ],
    endpoints: [endpointSubSchema],
  }, 
  {
    timestamps: true,
    versionKey: false,
  }
);

// ==================== HIGH-PERFORMANCE INDEXES ====================

// 1. Fast subdocument path matching
projectApiHistorySchema.index({ projectID: 1, "endpoints.baseUrlPath": 1 });

// 2. Fast collaborator project history lookup
projectApiHistorySchema.index({ accessByUsernames: 1 });

module.exports = mongoose.models.ProjectApiHistory || mongoose.model('ProjectApiHistory', projectApiHistorySchema, 'ProjectApiHistory');