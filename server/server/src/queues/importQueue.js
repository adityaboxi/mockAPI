const { Queue } = require('bullmq');
const queueConnection = { connection: { url: process.env.REDIS_URL } };

const importQueue = new Queue('openapi-import', queueConnection);

module.exports = importQueue;