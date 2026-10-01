const mongoose = require('mongoose');

const cache = globalThis.__techHubMongoose || (globalThis.__techHubMongoose = { promise: null });

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured.');
  if (mongoose.connection.readyState === 2 && cache.promise) return cache.promise;

  cache.promise = mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  }).catch((error) => {
    cache.promise = null;
    throw error;
  });
  await cache.promise;
  return mongoose;
}

module.exports = { connectToDatabase };