// Script to import user data from users.json to MongoDB
import { User } from './db/models.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bs426808_db_user:8nHyut3Mf0MriFVW@quiztimeweb.tbhhej8.mongodb.net/quiztime';

// Simple password for all users
const SIMPLE_PASSWORD = '123456';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Function to hash password (always use simple password)
const hashPassword = async (password) => {
  // Use simple password for easier testing
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(SIMPLE_PASSWORD, salt);
};

// Import users from users.json to MongoDB
const importUsers = async () => {
  try {
    // Read users.json file
    const usersData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'users.json'), 'utf-8')
    );
    
    if (!usersData.users || !Array.isArray(usersData.users)) {
      console.error('Invalid users data format in users.json');
      process.exit(1);
    }
    
    console.log(`Found ${usersData.users.length} users in users.json`);
    console.log(`⚠️ IMPORTANT: All users will be created with simple password: "${SIMPLE_PASSWORD}"`);
    
    // Process each user
    for (const userData of usersData.users) {
      const { id, username, email, password, is_verified, score, questionsAnswered, createdAt, lastActivity, isAdmin } = userData;
      
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        console.log(`User with email ${email} already exists, updating...`);
        
        // Update existing user
        existingUser.username = username;
        existingUser.password = await hashPassword(password); // Uses simple password
        existingUser.is_verified = true; // Always set to verified
        existingUser.score = score || 0;
        existingUser.questionsAnswered = questionsAnswered || [];
        existingUser.lastActivity = lastActivity ? new Date(lastActivity) : new Date();
        
        await existingUser.save();
        console.log(`Updated user ${username} (${email}) with password: ${SIMPLE_PASSWORD}`);
      } else {
        // Create new user
        const newUser = new User({
          username,
          email,
          password: await hashPassword(password), // Uses simple password
          is_verified: true, // Always set to verified
          score: score || 0,
          questionsAnswered: questionsAnswered || [],
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          lastActivity: lastActivity ? new Date(lastActivity) : new Date()
        });
        
        await newUser.save();
        console.log(`Created user ${username} (${email}) with password: ${SIMPLE_PASSWORD}`);
      }
    }
    
    console.log('User import completed successfully!');
    console.log('======================================');
    console.log(`✅ All users now have password: ${SIMPLE_PASSWORD}`);
    console.log('✅ All users are marked as verified');
    console.log('======================================');
    
    // List all users for convenience
    const allUsers = await User.find().select('username email');
    console.log('\nAvailable test accounts:');
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.username}) - Password: ${SIMPLE_PASSWORD}`);
    });
    
  } catch (error) {
    console.error('Error importing users:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

// Run the import
importUsers();