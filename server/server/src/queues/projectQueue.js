require('../opentelemetry/universal-logger');  // <-- Add this line FIRST

const { Queue } = require('bullmq');

const connectionOpts = {
  url: process.env.REDIS_URL || 'redis://redis-external:6379',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const projectQueue = new Queue('projectQueue', {
  connection: connectionOpts,
});

module.exports = projectQueue;

