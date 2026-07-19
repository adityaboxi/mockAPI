const mongoose = require('mongoose');

const versionSubSchema = new mongoose.Schema({
  protocol: { type: String, enum: ['http', 'https', 'ws', 'wss'], default: 'https' },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], required: true },
  urlPath: { type: String, required: true },
  pathParams: [{ key: String, value: String, _id: false }],
  queryParams: [{ key: String, value: String, _id: false }],
  requestBody: { type: mongoose.Schema.Types.Mixed, default: null },
  responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
  version: { type: String, required: true, trim: true },
  actualFullUrl: { type: String, trim: true },
  airesponse: { type: Boolean, default: false },
  isAuthEnabled: { type: Boolean, default: false },
  authScheme: { type: String, default: 'BearerAuth', enum: ['BearerAuth', 'ApiKeyAuth'] },
  latency: { type: Number, default: 0 },
  rateLimit: { type: Number, default: 0 },
  statusCode: { type: Number, default: 200, min: 100, max: 599 },
  headers: [{ key: String, value: String, _id: false }],
  responseHeaders: [{ key: String, value: String, _id: false }],
  cookies: [{
    key: String,
    value: String,
    options: {
      httpOnly: { type: Boolean, default: false },
      secure: { type: Boolean, default: false },
      sameSite: { type: String, enum: ['Strict', 'Lax', 'None'], default: 'Lax' },
      maxAge: Number,
      domain: String,
      path: { type: String, default: '/' }
    },
    _id: false
  }],
  expectedToken: { type: String, default: '' },
  expectedApiKey: { type: String, default: '' },
}, { timestamps: true, _id: true });

const endpointSubSchema = new mongoose.Schema({
  baseUrlPath: { type: String, required: true },
  versions: [versionSubSchema],
  accessBy: [{ type: String, trim: true }],
}, { timestamps: true, _id: true });

const projectApiHistorySchema = new mongoose.Schema({
  projectID: { type: String, required: true, unique: true, index: true },
  projectCode: { type: String, required: true, unique: true, index: true },
  accessByUsernames: [{ type: String, trim: true }],
  endpoints: [endpointSubSchema],
}, { timestamps: true });

projectApiHistorySchema.index({ projectID: 1, 'endpoints.baseUrlPath': 1 });

module.exports = mongoose.model('ProjectApiHistory', projectApiHistorySchema, 'ProjectApiHistory');


