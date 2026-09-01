require('../opentelemetry/universal-logger');  // <-- Add this line FIRST
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error("❌ MONGO_URI is not defined in environment variables!");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 100,
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE, 10) || 15,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;