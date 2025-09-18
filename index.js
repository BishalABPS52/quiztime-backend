import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDB from './db/connection.js';
import { Question, User, Stats, Leaderboard } from './db/models.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
connectDB();

// For fallback to JSON files if needed
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USER_QUESTIONS_FILE = path.join(DATA_DIR, 'user_questions.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const LEVELS = ['easy', 'medium', 'hard'];

function getQuestions(level) {
  const filePath = path.join(DATA_DIR, `${level}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getUserQuestions(username) {
  if (!fs.existsSync(USER_QUESTIONS_FILE)) return {};
  const data = JSON.parse(fs.readFileSync(USER_QUESTIONS_FILE, 'utf-8'));
  return data[username] || [];
}

function setUserQuestions(username, questions) {
  let data = {};
  if (fs.existsSync(USER_QUESTIONS_FILE)) {
    data = JSON.parse(fs.readFileSync(USER_QUESTIONS_FILE, 'utf-8'));
  }
  data[username] = questions;
  fs.writeFileSync(USER_QUESTIONS_FILE, JSON.stringify(data, null, 2));
}

function getUserScores() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function setUserScore(username, score) {
  let data = {};
  if (fs.existsSync(USERS_FILE)) {
    data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  }
  data[username] = score;
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function getUserStats(username) {
  if (!fs.existsSync(STATS_FILE)) return null;
  const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  return stats[username] || null;
}

function setUserStats(username, stats) {
  let data = {};
  if (fs.existsSync(STATS_FILE)) {
    data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  }
  data[username] = stats;
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

function getLeaderboard() {
  if (!fs.existsSync(LEADERBOARD_FILE)) {
    return { leaderboard: [] };
  }
  return JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf-8'));
}

function updateLeaderboard(username, gameStats) {
  const leaderboard = getLeaderboard();
  const userIndex = leaderboard.leaderboard.findIndex(entry => entry.username === username);
  
  const leaderboardEntry = {
    username,
    score: gameStats.score,
    questionsAnswered: gameStats.questionsAnswered,
    correctAnswers: gameStats.correctAnswers,
    averageTimePerQuestion: gameStats.averageTimePerQuestion,
    totalTime: gameStats.totalTime,
    date: new Date().toISOString()
  };
  
  if (userIndex >= 0) {
    // Update if better score or more recent
    if (leaderboardEntry.score > leaderboard.leaderboard[userIndex].score) {
      leaderboard.leaderboard[userIndex] = leaderboardEntry;
    }
  } else {
    leaderboard.leaderboard.push(leaderboardEntry);
  }
  
  // Sort by score (descending)
  leaderboard.leaderboard.sort((a, b) => b.score - a.score);
  
  // Keep top 100 only
  if (leaderboard.leaderboard.length > 100) {
    leaderboard.leaderboard = leaderboard.leaderboard.slice(0, 100);
  }
  
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
}

// API: Get questions for a level, avoiding repeats for user
app.post('/api/questions', async (req, res) => {
  try {
    const { username, level, count } = req.body;
    if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Invalid level' });
    
    // Find the user or create a new one
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username, questionsAnswered: [] });
      await user.save();
    }
    
    // Find questions that user hasn't answered yet
    const questions = await Question.find({ 
      level, 
      id: { $nin: user.questionsAnswered } 
    }).limit(parseInt(count));
    
    // If MongoDB doesn't have enough questions, fallback to JSON file
    if (questions.length === 0) {
      const allQuestions = getQuestions(level);
      const userQuestions = getUserQuestions(username);
      const unusedQuestions = allQuestions.filter(q => !userQuestions.includes(q.id));
      const selected = unusedQuestions.slice(0, count);
      setUserQuestions(username, [...userQuestions, ...selected.map(q => q.id)]);
      
      // Add these questions to MongoDB for future use
      const questionDocs = selected.map(q => new Question({
        id: q.id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        level
      }));
      
      if (questionDocs.length > 0) {
        await Question.insertMany(questionDocs);
      }
      
      return res.json(selected);
    }
    
    // Update user's answered questions
    user.questionsAnswered.push(...questions.map(q => q.id));
    await user.save();
    
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Server error fetching questions' });
  }
});

// API: Get lifelines
app.get('/api/lifelines', (req, res) => {
  res.json({
    lifelines: [
      '50-50',
      'skip',
      'audience',
      'hint',
      'timer-extension'
    ]
  });
});

// API: Save user score
app.post('/api/score', (req, res) => {
  const { username, score } = req.body;
  setUserScore(username, score);
  res.json({ success: true });
});

// API: Get user score
app.get('/api/score/:username', (req, res) => {
  const scores = getUserScores();
  res.json({ score: scores[req.params.username] || 0 });
});

// API: Save detailed game stats and update leaderboard
app.post('/api/stats', async (req, res) => {
  try {
    const { 
      username, 
      score, 
      questionsAnswered, 
      correctAnswers,
      wrongAnswers,
      averageTimePerQuestion,
      totalTime,
      level,
      lifelinesUsed
    } = req.body;
    
    const gameStats = {
      score,
      questionsAnswered,
      correctAnswers,
      wrongAnswers,
      averageTimePerQuestion,
      totalTime,
      level,
      lifelinesUsed,
      lastPlayed: new Date()
    };
    
    // Update user stats in MongoDB
    let stats = await Stats.findOne({ username });
    if (stats) {
      // Update existing stats
      stats.score = score;
      stats.questionsAnswered = questionsAnswered;
      stats.correctAnswers = correctAnswers;
      stats.wrongAnswers = wrongAnswers;
      stats.averageTimePerQuestion = averageTimePerQuestion;
      stats.totalTime = totalTime;
      stats.level = level;
      stats.lifelinesUsed = lifelinesUsed;
      stats.lastPlayed = new Date();
      await stats.save();
    } else {
      // Create new stats
      stats = new Stats({
        username,
        ...gameStats
      });
      await stats.save();
    }
    
    // Update user's score
    let user = await User.findOne({ username });
    if (user) {
      user.score = score;
      user.lastActivity = new Date();
      await user.save();
    } else {
      user = new User({
        username,
        score,
        lastActivity: new Date()
      });
      await user.save();
    }
    
    // Update leaderboard
    let leaderboard = await Leaderboard.findOne({});
    if (!leaderboard) {
      leaderboard = new Leaderboard({ entries: [] });
    }
    
    const leaderboardEntry = {
      username,
      score,
      questionsAnswered,
      correctAnswers,
      averageTimePerQuestion,
      totalTime,
      date: new Date()
    };
    
    const existingEntryIndex = leaderboard.entries.findIndex(entry => entry.username === username);
    if (existingEntryIndex >= 0) {
      // Update if better score
      if (leaderboardEntry.score > leaderboard.entries[existingEntryIndex].score) {
        leaderboard.entries[existingEntryIndex] = leaderboardEntry;
      }
    } else {
      leaderboard.entries.push(leaderboardEntry);
    }
    
    // Sort by score (descending)
    leaderboard.entries.sort((a, b) => b.score - a.score);
    
    // Keep top 100 only
    if (leaderboard.entries.length > 100) {
      leaderboard.entries = leaderboard.entries.slice(0, 100);
    }
    
    await leaderboard.save();
    
    // Fallback: Also update JSON files for backward compatibility
    setUserStats(username, gameStats);
    updateLeaderboard(username, gameStats);
    setUserScore(username, score);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving stats:', error);
    res.status(500).json({ error: 'Server error saving stats' });
  }
});

// API: Get user stats
app.get('/api/stats/:username', (req, res) => {
  const stats = getUserStats(req.params.username);
  if (!stats) {
    return res.json({ 
      error: 'No stats found',
      stats: {
        score: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        averageTimePerQuestion: 0,
        totalTime: 0,
        lifelinesUsed: {}
      }
    });
  }
  res.json({ stats });
});

// API: Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Get leaderboard from MongoDB
    let leaderboard = await Leaderboard.findOne({});
    
    // If no leaderboard in MongoDB, try fallback to JSON file
    if (!leaderboard || leaderboard.entries.length === 0) {
      const jsonLeaderboard = getLeaderboard();
      
      // If we got data from JSON, save it to MongoDB for future
      if (jsonLeaderboard.leaderboard && jsonLeaderboard.leaderboard.length > 0) {
        if (!leaderboard) {
          leaderboard = new Leaderboard({
            entries: jsonLeaderboard.leaderboard.map(entry => ({
              username: entry.username,
              score: entry.score,
              questionsAnswered: entry.questionsAnswered,
              correctAnswers: entry.correctAnswers,
              averageTimePerQuestion: entry.averageTimePerQuestion,
              totalTime: entry.totalTime,
              date: entry.date ? new Date(entry.date) : new Date()
            }))
          });
          await leaderboard.save();
        }
        
        return res.json({ leaderboard: leaderboard.entries });
      }
      
      // No data in MongoDB or JSON file
      return res.json({ leaderboard: [] });
    }
    
    // Return MongoDB leaderboard
    res.json({ leaderboard: leaderboard.entries });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    
    // Fallback to JSON file if MongoDB fails
    const jsonLeaderboard = getLeaderboard();
    res.json(jsonLeaderboard);
  }
});

// API: Reset user questions (for testing)
app.post('/api/reset-questions', (req, res) => {
  const { username } = req.body;
  setUserQuestions(username, []);
  res.json({ success: true });
});

// Add healthcheck endpoint for deployment platforms
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'QuizTime API is running' });
});

// Handle API versioning
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to QuizTime API',
    version: '1.0.0',
    endpoints: {
      questions: '/api/questions',
      lifelines: '/api/lifelines',
      score: '/api/score/:username',
      stats: '/api/stats/:username',
      leaderboard: '/api/leaderboard'
    }
  });
});

// Root route for documentation
app.get('/', (req, res) => {
  res.json({
    name: 'QuizTime API',
    description: 'Backend API for QuizTime application',
    version: '1.0.0',
    status: 'running',
    documentation: {
      health: '/health - API health check',
      api: '/api - API information and available endpoints',
      questions: '/api/questions - Get quiz questions (POST)',
      lifelines: '/api/lifelines - Get available lifelines (GET)',
      checkAnswer: '/api/check-answer - Verify answers (POST)',
      stats: '/api/stats/:username - Get user statistics (GET)',
      leaderboard: '/api/leaderboard - Get game leaderboard (GET)'
    }
  });
});

// Check if answer is correct
app.post('/api/check-answer', (req, res) => {
  const { level, questionId, answer } = req.body;
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Invalid level' });
  
  const questions = getQuestions(level);
  const question = questions.find(q => q.id === questionId);
  
  if (!question) return res.status(404).json({ error: 'Question not found' });
  
  const isCorrect = question.answer === answer;
  
  res.json({
    correct: isCorrect,
    correctAnswer: isCorrect ? null : question.answer
  });
});

app.listen(PORT, () => {
  console.log(`QuizTime backend running on port ${PORT}`);
});
