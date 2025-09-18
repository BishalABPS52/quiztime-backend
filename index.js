import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(bodyParser.json());

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
app.post('/api/questions', (req, res) => {
  const { username, level, count } = req.body;
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Invalid level' });
  const allQuestions = getQuestions(level);
  const userQuestions = getUserQuestions(username);
  const unusedQuestions = allQuestions.filter(q => !userQuestions.includes(q.id));
  const selected = unusedQuestions.slice(0, count);
  setUserQuestions(username, [...userQuestions, ...selected.map(q => q.id)]);
  res.json(selected);
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
app.post('/api/stats', (req, res) => {
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
    lastPlayed: new Date().toISOString()
  };
  
  // Update user stats
  setUserStats(username, gameStats);
  
  // Update leaderboard
  updateLeaderboard(username, gameStats);
  
  // Also update basic score
  setUserScore(username, score);
  
  res.json({ success: true });
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
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = getLeaderboard();
  res.json(leaderboard);
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
