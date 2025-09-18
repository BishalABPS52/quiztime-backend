import mongoose from 'mongoose';

// MongoDB connection URL (from environment variable or use the direct connection string)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bs426808_db_user:8nHyut3Mf0MriFVW@quiztimeweb.tbhhej8.mongodb.net/quiztime';

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Connect with modern options (no deprecated options)
    const conn = await mongoose.connect(MONGODB_URI);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;