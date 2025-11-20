// Script to create test user accounts in MongoDB
import { User } from './db/models.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bs426808_db_user:8nHyut3Mf0MriFVW@quiztimeweb.tbhhej8.mongodb.net/quiztime';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Test users to create
const testUsers = [
  {
    username: 'test_user',
    email: 'test@example.com',
    password: 'test123',
    is_verified: true
  },
  {
    username: 'demo_user',
    email: 'demo@example.com',
    password: 'demo123',
    is_verified: true
  },
  {
    username: 'quiz_master',
    email: 'quiz@example.com',
    password: 'quiz123',
    is_verified: true,
    score: 5000
  },
  {
    username: 'admin_user',
    email: 'admin@quiztime.com',
    password: 'admin123',
    is_verified: true,
    isAdmin: true
  },
  {
    username: 'bishal_test',
    email: 'bishal.test@example.com',
    password: 'bishal123',
    is_verified: true,
    score: 3000
  }
];

// Create test users
const createTestUsers = async () => {
  try {
    console.log('Creating test users...');
    
    // Process each user
    for (const userData of testUsers) {
      const { username, email, password, is_verified, score, isAdmin } = userData;
      
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        console.log(`User with email ${email} already exists, skipping...`);
      } else {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new user
        const newUser = new User({
          username,
          email,
          password: hashedPassword,
          is_verified: is_verified || true,
          score: score || 0,
          questionsAnswered: [],
          createdAt: new Date(),
          lastActivity: new Date()
        });
        
        await newUser.save();
        console.log(`Created user ${username} (${email}) with password: ${password}`);
      }
    }
    
    console.log('Test users created successfully!');
    
    // Print login credentials for reference
    console.log('\nTest User Credentials:');
    testUsers.forEach(user => {
      console.log(`- ${user.username} (${user.email}): ${user.password}`);
    });
    
  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the function
createTestUsers();