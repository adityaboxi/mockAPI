/*const { redisClient } = require('../config/redis');
const TTL = parseInt(process.env.TTL, 10) ; 
function getDefinitionKey(projectId, version, method, urlpath) {
return `mockapi:def:${projectId}:${version}:${method.toUpperCase()}:${urlpath}`;
}
async function storeMockDefinition(projectId, version, method, urlpath, definition) {
const key = getDefinitionKey(projectId, version, method, urlpath);
try {
await redisClient.setEx(key, TTL, JSON.stringify(definition));
  } catch (err) {
    console.error(`[Redis] Failed to store ${key}:`, err.message);
throw err;
  }
}


async function deleteMockDefinition(projectId, version, method, urlpath) {
const key = getDefinitionKey(projectId, version, method, urlpath);
try {
await redisClient.del(key);
  } catch (err) {
    console.error(`[Redis] Failed to delete ${key}:`, err.message);
throw err;
  }
}
module.exports = {storeMockDefinition, deleteMockDefinition, getDefinitionKey };*/




const { redisClient } = require('../config/redis');

const TTL = parseInt(process.env.TTL, 10);

function getDefinitionKey(projectId, version, method, urlpath) {
  return `mockapi:def:${projectId}:${version}:${method.toUpperCase()}:${urlpath}`;
}

async function storeMockDefinition(projectId, version, method, urlpath, definition) {
  const key = getDefinitionKey(projectId, version, method, urlpath);
  await redisClient.setEx(key, TTL, JSON.stringify(definition));
}

async function deleteMockDefinition(projectId, version, method, urlpath) {
  const key = getDefinitionKey(projectId, version, method, urlpath);
  await redisClient.del(key);
}




module.exports = { storeMockDefinition, deleteMockDefinition, getDefinitionKey };