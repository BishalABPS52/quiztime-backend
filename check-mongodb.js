import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bs426808_db_user:8nHyut3Mf0MriFVW@quiztimeweb.tbhhej8.mongodb.net/quiztime';

// Create schema definitions
const questionSchema = new mongoose.Schema({
  id: String,
  question: String,
  options: [String],
  answer: String,
  level: String,
  category: String
});

const userSchema = new mongoose.Schema({
  username: String,
  score: Number,
  questionsAnswered: [String],
  createdAt: Date,
  lastActivity: Date
});

const statsSchema = new mongoose.Schema({
  username: String,
  score: Number,
  questionsAnswered: Number,
  correctAnswers: Number,
  wrongAnswers: Number,
  averageTimePerQuestion: Number,
  totalTime: Number,
  level: String,
  lifelinesUsed: Object,
  lastPlayed: Date
});

const leaderboardSchema = new mongoose.Schema({
  entries: [{
    username: String,
    score: Number,
    questionsAnswered: Number,
    correctAnswers: Number,
    averageTimePerQuestion: Number,
    totalTime: Number,
    date: Date
  }]
});

async function checkData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Initialize models
    const Question = mongoose.model('Question', questionSchema);
    const User = mongoose.model('User', userSchema);
    const Stats = mongoose.model('Stats', statsSchema);
    const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
    
    // Count questions by level
    const easyQuestions = await Question.countDocuments({ level: 'easy' });
    const mediumQuestions = await Question.countDocuments({ level: 'medium' });
    const hardQuestions = await Question.countDocuments({ level: 'hard' });
    const totalQuestions = await Question.countDocuments();
    
    console.log('\n===== QUESTION COUNTS =====');
    console.log(`Easy: ${easyQuestions}`);
    console.log(`Medium: ${mediumQuestions}`);
    console.log(`Hard: ${hardQuestions}`);
    console.log(`Total: ${totalQuestions}`);
    
    // Sample questions from each level
    console.log('\n===== SAMPLE QUESTIONS =====');
    const sampleEasy = await Question.findOne({ level: 'easy' });
    const sampleMedium = await Question.findOne({ level: 'medium' });
    const sampleHard = await Question.findOne({ level: 'hard' });
    
    console.log('\nEasy Sample:');
    console.log(sampleEasy);
    console.log('\nMedium Sample:');
    console.log(sampleMedium);
    console.log('\nHard Sample:');
    console.log(sampleHard);
    
    // Check users
    const userCount = await User.countDocuments();
    console.log('\n===== USER DATA =====');
    console.log(`Total Users: ${userCount}`);
    if (userCount > 0) {
      const users = await User.find().limit(3);
      console.log('Sample Users:');
      console.log(users);
    }
    
    // Check stats
    const statsCount = await Stats.countDocuments();
    console.log('\n===== STATS DATA =====');
    console.log(`Total User Stats: ${statsCount}`);
    if (statsCount > 0) {
      const stats = await Stats.find().limit(3);
      console.log('Sample Stats:');
      console.log(stats);
    }
    
    // Check leaderboard
    const leaderboardData = await Leaderboard.findOne({});
    console.log('\n===== LEADERBOARD DATA =====');
    if (leaderboardData && leaderboardData.entries) {
      console.log(`Leaderboard Entries: ${leaderboardData.entries.length}`);
      if (leaderboardData.entries.length > 0) {
        console.log('Top 3 Entries:');
        console.log(leaderboardData.entries.slice(0, 3));
      }
    } else {
      console.log('No leaderboard data found');
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
  } catch (error) {
    console.error('Error checking data:', error);
  }
}

checkData();