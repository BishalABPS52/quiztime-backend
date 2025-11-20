import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDB from './db/connection.js';
import { Question, User, Stats, Leaderboard } from './db/models.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');

async function clearAndImportData() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Clear existing data
    console.log('Clearing existing data...');
    await Question.deleteMany({});
    await User.deleteMany({});
    await Stats.deleteMany({});
    await Leaderboard.deleteMany({});
    console.log('Cleared all existing data');
    
    // Import questions from questions.json
    console.log('Importing questions...');
    const questionsFilePath = path.join(DATA_DIR, 'questions.json');
    if (fs.existsSync(questionsFilePath)) {
      const questions = JSON.parse(fs.readFileSync(questionsFilePath, 'utf-8'));
      console.log(`Found ${questions.length} questions`);
      
      for (const q of questions) {
        await Question.create({
          id: q.id,
          question: q.question,
          options: q.options,
          answer: q.answer,
          category: 'general'
        });
      }
      console.log(`Imported ${questions.length} questions`);
    } else {
      console.log('questions.json not found!');
    }
    
    // Import users from users.json
    console.log('Importing users...');
    const usersFilePath = path.join(DATA_DIR, 'users.json');
    if (fs.existsSync(usersFilePath)) {
      const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
      
      for (const user of usersData.users) {
        await User.create({
          id: user.id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          password: user.password,
          is_verified: true,
          score: 0,
          questionsAnswered: [],
          createdAt: new Date(user.createdAt),
          lastActivity: new Date(user.lastActivity)
        });
      }
      console.log(`Imported ${usersData.users.length} users`);
    }
    
    // Import stats from stats.json
    console.log('Importing stats...');
    const statsFilePath = path.join(DATA_DIR, 'stats.json');
    if (fs.existsSync(statsFilePath)) {
      const statsData = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
      
      for (const stat of statsData.users) {
        await Stats.create({
          id: stat.id,
          userId: stat.userId,
          username: stat.username,
          gamesPlayed: stat.gamesPlayed,
          gamesCompleted: stat.gamesCompleted,
          totalPrizeMoney: stat.totalPrizeMoney,
          questionsAnswered: stat.questionsAnswered,
          accuracy: stat.accuracy,
          averageCompletionTime: stat.averageCompletionTime
        });
      }
      console.log(`Imported ${statsData.users.length} user stats`);
    }
    
    // Import leaderboard from leaderboard.json
    console.log('Importing leaderboard...');
    const leaderboardFilePath = path.join(DATA_DIR, 'leaderboard.json');
    if (fs.existsSync(leaderboardFilePath)) {
      const leaderboardData = JSON.parse(fs.readFileSync(leaderboardFilePath, 'utf-8'));
      
      // Map the leaderboard entries with proper date conversion
      const leaderboardEntries = leaderboardData.leaderboard.map(entry => ({
        id: entry.id,
        userId: entry.userId,
        playerName: entry.playerName,
        prizeWon: entry.prizeWon,
        questionsAnswered: entry.questionsAnswered,
        totalQuestions: entry.totalQuestions,
        completionDate: new Date(entry.completionDate),
        completionTime: entry.completionTime
      }));
      
      // Create single leaderboard document with the exact JSON structure
      await Leaderboard.create({
        leaderboard: leaderboardEntries
      });
      
      console.log(`Imported leaderboard with ${leaderboardData.leaderboard.length} entries`);
    }
    
    console.log('Data import complete!');
    
    // Verify the import
    const questionCount = await Question.countDocuments();
    const userCount = await User.countDocuments();
    const statsCount = await Stats.countDocuments();
    const leaderboard = await Leaderboard.findOne({});
    
    console.log('\n=== Import Summary ===');
    console.log(`Questions imported: ${questionCount}`);
    console.log(`Users imported: ${userCount}`);
    console.log(`Stats imported: ${statsCount}`);
    console.log(`Leaderboard entries: ${leaderboard ? leaderboard.leaderboard.length : 0}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  }
}

clearAndImportData();