const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;   // ← Fixed: MONGO_URI (no D)

  if (!mongoURI) {
    console.error("❌ MONGO_URI is not defined in environment variables!");
    console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('URI')));
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoURI);
   return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;