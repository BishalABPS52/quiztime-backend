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

async function importData() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Import questions
    console.log('Importing questions...');
    for (const level of ['easy', 'medium', 'hard']) {
      const filePath = path.join(DATA_DIR, `${level}.json`);
      if (fs.existsSync(filePath)) {
        const questions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log(`Found ${questions.length} ${level} questions`);
        
        // Check each question and add if it doesn't exist
        for (const q of questions) {
          const exists = await Question.findOne({ id: q.id });
          if (!exists) {
            await Question.create({
              id: q.id,
              question: q.question,
              options: q.options,
              answer: q.answer,
              level
            });
            console.log(`Added question: ${q.id}`);
          }
        }
      }
    }
    
    // Import users
    console.log('Importing users...');
    const usersFilePath = path.join(DATA_DIR, 'users.json');
    if (fs.existsSync(usersFilePath)) {
      const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
      for (const [username, score] of Object.entries(users)) {
        const exists = await User.findOne({ username });
        if (!exists) {
          await User.create({
            username,
            score
          });
          console.log(`Added user: ${username}`);
        } else {
          exists.score = score;
          await exists.save();
          console.log(`Updated user: ${username}`);
        }
      }
    }
    
    // Import user questions
    console.log('Importing user questions...');
    const userQuestionsFilePath = path.join(DATA_DIR, 'user_questions.json');
    if (fs.existsSync(userQuestionsFilePath)) {
      const userQuestions = JSON.parse(fs.readFileSync(userQuestionsFilePath, 'utf-8'));
      for (const [username, questions] of Object.entries(userQuestions)) {
        const user = await User.findOne({ username });
        if (user) {
          user.questionsAnswered = questions;
          await user.save();
          console.log(`Updated user questions: ${username}`);
        }
      }
    }
    
    // Import stats
    console.log('Importing stats...');
    const statsFilePath = path.join(DATA_DIR, 'stats.json');
    if (fs.existsSync(statsFilePath)) {
      const stats = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
      for (const [username, userStats] of Object.entries(stats)) {
        const exists = await Stats.findOne({ username });
        if (!exists) {
          await Stats.create({
            username,
            ...userStats,
            lastPlayed: userStats.lastPlayed ? new Date(userStats.lastPlayed) : new Date()
          });
          console.log(`Added stats: ${username}`);
        } else {
          Object.assign(exists, {
            ...userStats,
            lastPlayed: userStats.lastPlayed ? new Date(userStats.lastPlayed) : new Date()
          });
          await exists.save();
          console.log(`Updated stats: ${username}`);
        }
      }
    }
    
    // Import leaderboard
    console.log('Importing leaderboard...');
    const leaderboardFilePath = path.join(DATA_DIR, 'leaderboard.json');
    if (fs.existsSync(leaderboardFilePath)) {
      const leaderboardData = JSON.parse(fs.readFileSync(leaderboardFilePath, 'utf-8'));
      if (leaderboardData.leaderboard && leaderboardData.leaderboard.length > 0) {
        const leaderboard = await Leaderboard.findOne({});
        if (!leaderboard) {
          await Leaderboard.create({
            entries: leaderboardData.leaderboard.map(entry => ({
              ...entry,
              date: entry.date ? new Date(entry.date) : new Date()
            }))
          });
          console.log(`Added leaderboard with ${leaderboardData.leaderboard.length} entries`);
        } else {
          // Merge with existing leaderboard
          const existingUsernames = new Set(leaderboard.entries.map(e => e.username));
          const newEntries = leaderboardData.leaderboard
            .filter(e => !existingUsernames.has(e.username))
            .map(e => ({
              ...e,
              date: e.date ? new Date(e.date) : new Date()
            }));
            
          leaderboard.entries = [...leaderboard.entries, ...newEntries];
          leaderboard.entries.sort((a, b) => b.score - a.score);
          
          if (leaderboard.entries.length > 100) {
            leaderboard.entries = leaderboard.entries.slice(0, 100);
          }
          
          await leaderboard.save();
          console.log(`Updated leaderboard, now has ${leaderboard.entries.length} entries`);
        }
      }
    }
    
    console.log('Data import complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  }
}

importData();