import mongoose from 'mongoose';

// MongoDB connection URL (from environment variable)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quiztime';

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      // These options are no longer needed in newer versions of mongoose
      // but added for compatibility
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;