// queues/aiQueue.js
require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { Queue } = require('bullmq');
const connection = { connection: { url: process.env.REDIS_URL } };

const aiQueue = new Queue('ai-queue', connection);

module.exports = aiQueue;