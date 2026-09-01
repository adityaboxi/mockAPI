require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const mongoose = require('mongoose');

// Version Sub-Schema (stores configuration for a single API version)
const versionSubSchema = new mongoose.Schema(
  {
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
    },
    pathParams: [{ key: String, value: String, _id: false }],
    queryParams: [{ key: String, value: String, _id: false }],
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
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
    isAuthEnabled: {
      type: Boolean,
      default: false,
    },
    authScheme: {
      type: String,
      default: 'BearerAuth',
      enum: ['BearerAuth', 'ApiKeyAuth', 'bearer', 'jwt', 'apiKey', 'api-key', 'apikey', 'Bearer', 'ApiKey'],
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
    headers: [{ key: String, value: String, _id: false }],
    responseHeaders: [{ key: String, value: String, _id: false }],
    cookies: [
      {
        key: String,
        value: String,
        options: {
          httpOnly: { type: Boolean, default: false },
          secure: { type: Boolean, default: false },
          sameSite: { type: String, enum: ['Strict', 'Lax', 'None', 'strict', 'lax', 'none'], default: 'Lax' },
          maxAge: Number,
          domain: String,
          path: { type: String, default: '/' },
        },
        _id: false,
      },
    ],
    expectedToken: { type: String, default: '' },
    expectedApiKey: { type: String, default: '' },
    summary: { type: String, default: '' },
    description: { type: String, default: '' },
    operationId: { type: String, default: '' },
  },
  {
    timestamps: true,
    _id: true,
    versionKey: false,
  }
);

// Endpoint Sub-Schema
const endpointSubSchema = new mongoose.Schema(
  {
    baseUrlPath: {
      type: String,
      required: true,
    },
    versions: [versionSubSchema],
    accessBy: [
      {
        type: String,
        trim: true,
      },
    ],
    noofVersions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    _id: true,
    versionKey: false,
  }
);

// Main Project API History Schema
const projectApiHistorySchema = new mongoose.Schema(
  {
    projectID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    projectCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accessByUsernames: [
      {
        type: String,
        trim: true,
      },
    ],
    endpoints: [endpointSubSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound & Multikey Indexes
projectApiHistorySchema.index({ projectID: 1, 'endpoints.baseUrlPath': 1 });
projectApiHistorySchema.index({ accessByUsernames: 1 });

module.exports =
  mongoose.models.ProjectApiHistory ||
  mongoose.model('ProjectApiHistory', projectApiHistorySchema, 'ProjectApiHistory');