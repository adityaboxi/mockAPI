const { Queue } = require('bullmq');

const projectQueue = new Queue('projectQueue', {
  connection: {
    url: process.env.REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
});

module.exports = projectQueue;