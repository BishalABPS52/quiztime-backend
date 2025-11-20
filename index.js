import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import winston from 'winston';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import connectDB from './db/connection.js';
import { Question, User, Stats, Leaderboard } from './db/models.js';
import adminRoutes from './admin.js';
import authRoutes, { authenticateToken } from './auth.js';
import userRoutes from './user.js';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'quiztime-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN || false
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
connectDB().then(() => {
  logger.info('Database connection established');
}).catch((error) => {
  logger.error('Database connection failed:', error);
  process.exit(1);
});

// For fallback to JSON files if needed
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USER_QUESTIONS_FILE = path.join(DATA_DIR, 'user_questions.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

function getAllQuestions() {
  const filePath = path.join(DATA_DIR, 'questions.json');
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Helper function to randomly select questions
function getRandomQuestions(questionsPool, count) {
  if (questionsPool.length <= count) {
    return [...questionsPool]; // Return all if not enough questions
  }
  
  const shuffled = [...questionsPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
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

// API: Get questions for a game with level progression and timing (16 questions total)
app.post('/api/game/questions', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    
    // Find or create user
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username, questionsAnswered: [] });
      await user.save();
    }
    
    // Game structure: Q1-Q3: easy (10s), Q4-Q9: medium (20s), Q10-Q16: hard (30s)
    const gameQuestions = [];
    
    // Prize structure for 16 questions
    const prizeStructure = [
      1000, 2000, 3000, // Easy (Q1-Q3)
      5000, 10000, 20000, 50000, 100000, 200000, // Medium (Q4-Q9) 
      500000, 1000000, 2000000, 5000000, 10000000, 50000000, 700000000 // Hard (Q10-Q16)
    ];
    
    // Get all questions from questions.json
    const allAvailableQuestions = getAllQuestions();
    
    // Randomly select 16 different questions for the game
    const selectedQuestions = getRandomQuestions(allAvailableQuestions, 16);
    
    // Build 16 questions with progressive difficulty timing
    let allQuestions = [];
    
    selectedQuestions.forEach((q, i) => {
      // Determine time limit based on question position (progressive difficulty)
      let timeLimit = 10; // Default easy time
      let level = 'easy';
      
      if (i >= 3 && i < 9) {
        timeLimit = 20; // Medium difficulty timing
        level = 'medium';
      } else if (i >= 9) {
        timeLimit = 30; // Hard difficulty timing
        level = 'hard';
      }
      
      allQuestions.push({
        id: q.id,
        question: q.question,
        options: q.options,
        answer: q.options.indexOf(q.answer), // Convert answer to index
        questionNumber: i + 1,
        timeLimit: timeLimit,
        level: level,
        prizeValue: prizeStructure[i]
      });
    });
    
    // Ensure we have exactly 16 questions
    if (allQuestions.length < 16) {
      console.log(`Warning: Only ${allQuestions.length} questions available, padding with random selections`);
      // Pad with additional random questions if needed
      while (allQuestions.length < 16 && allAvailableQuestions.length > 0) {
        const randomQ = allAvailableQuestions[Math.floor(Math.random() * allAvailableQuestions.length)];
        
        // Avoid duplicates by checking if question already exists
        const isDuplicate = allQuestions.some(q => q.id === randomQ.id);
        if (!isDuplicate) {
          const questionIndex = allQuestions.length;
          let timeLimit = 10;
          let level = 'easy';
          
          if (questionIndex >= 3 && questionIndex < 9) {
            timeLimit = 20;
            level = 'medium';
          } else if (questionIndex >= 9) {
            timeLimit = 30;
            level = 'hard';
          }
          
          allQuestions.push({
            id: randomQ.id,
            question: randomQ.question,
            options: randomQ.options,
            answer: randomQ.options.indexOf(randomQ.answer),
            questionNumber: questionIndex + 1,
            timeLimit: timeLimit,
            level: level,
            prizeValue: prizeStructure[questionIndex] || 1000000
          });
        }
      }
    }
    
    // Limit to exactly 16 questions
    allQuestions = allQuestions.slice(0, 16);
    
    // Log question selection for debugging
    logger.info(`Generated ${allQuestions.length} questions for new game:`, {
      easy: allQuestions.filter(q => q.level === 'easy').length,
      medium: allQuestions.filter(q => q.level === 'medium').length,
      hard: allQuestions.filter(q => q.level === 'hard').length,
      questionIds: allQuestions.map(q => q.id)
    });
    
    res.json({
      questions: allQuestions,
      totalQuestions: 16,
      gameStructure: {
        easy: { questions: '1-3', timeLimit: 10, prize: '1K-3K' },
        medium: { questions: '4-9', timeLimit: 20, prize: '5K-200K' },
        hard: { questions: '10-16', timeLimit: 30, prize: '500K-700M' }
      }
    });
  } catch (error) {
    logger.error('Error fetching game questions:', error);
    res.status(500).json({ error: 'Server error fetching game questions' });
  }
});

// API: Get random questions for user (backwards compatibility)
app.post('/api/questions', async (req, res) => {
  try {
    const { username, count = 20 } = req.body;
    
    // Find the user or create a new one
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username, questionsAnswered: [] });
      await user.save();
    }
    
    // Find questions that user hasn't answered yet
    const questions = await Question.find({ 
      id: { $nin: user.questionsAnswered } 
    }).limit(parseInt(count));
    
    // If MongoDB doesn't have enough questions, fallback to JSON file
    if (questions.length === 0) {
      const allQuestions = getAllQuestions();
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
        category: 'general'
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
    logger.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Server error fetching questions' });
  }
});

// API: Get random questions without level restrictions
app.post('/api/questions/random', async (req, res) => {
  try {
    const { count = 16 } = req.body;
    
    // Get all questions from MongoDB
    let questions = await Question.find({});
    
    // If MongoDB doesn't have enough questions, fallback to JSON file
    if (questions.length < count) {
      const allQuestions = getAllQuestions();
      
      // Convert JSON questions to proper format and add to response
      const jsonQuestions = allQuestions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        category: q.category || 'general'
      }));
      
      // Combine and deduplicate
      const existingIds = new Set(questions.map(q => q.id));
      const newQuestions = jsonQuestions.filter(q => !existingIds.has(q.id));
      questions = [...questions, ...newQuestions];
    }
    
    // Randomly shuffle and select the requested count
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, count);
    
    res.json(selectedQuestions);
  } catch (error) {
    logger.error('Error fetching random questions:', error);
    res.status(500).json({ error: 'Server error fetching random questions' });
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
      userId,
      gamesPlayed,
      gamesCompleted,
      totalPrizeMoney, 
      questionsAnswered, 
      accuracy,
      averageCompletionTime
    } = req.body;
    
    // Update user stats in MongoDB using new model structure
    let stats = await Stats.findOne({ username });
    if (stats) {
      // Update existing stats
      stats.gamesPlayed = gamesPlayed || (stats.gamesPlayed + 1);
      stats.gamesCompleted = gamesCompleted || stats.gamesCompleted;
      stats.totalPrizeMoney = totalPrizeMoney || stats.totalPrizeMoney;
      stats.questionsAnswered = questionsAnswered || stats.questionsAnswered;
      stats.accuracy = accuracy || stats.accuracy;
      stats.averageCompletionTime = averageCompletionTime || stats.averageCompletionTime;
      await stats.save();
    } else {
      // Create new stats with proper ID
      const lastStat = await Stats.findOne().sort({ id: -1 });
      const newId = lastStat ? lastStat.id + 1 : 1;
      
      stats = new Stats({
        id: newId,
        userId: userId || `qt${newId}`,
        username,
        gamesPlayed: gamesPlayed || 1,
        gamesCompleted: gamesCompleted || 0,
        totalPrizeMoney: totalPrizeMoney || 0,
        questionsAnswered: questionsAnswered || 0,
        accuracy: accuracy || 0,
        averageCompletionTime: averageCompletionTime || "0:00"
      });
      await stats.save();
    }
    
    // Update user's score
    let user = await User.findOne({ username });
    if (user) {
      user.lastActivity = new Date();
      await user.save();
    }
    res.json({ success: true, message: 'Game stats updated successfully' });
  } catch (error) {
    logger.error('Error saving stats:', error);
    res.status(500).json({ error: 'Server error saving stats' });
  }
});

// API: Complete game and save results (authenticated)
app.post('/api/game/complete', authenticateToken, async (req, res) => {
  try {
    const {
      questionsAnswered,
      correctAnswers,
      totalQuestions,
      finalPrize,
      completionTime,
      gameCompleted
    } = req.body;
    
    const { username, id: userId } = req.user;
    
    // Save user stats
    let stats = await Stats.findOne({ username });
    if (stats) {
      stats.gamesPlayed += 1;
      if (gameCompleted) stats.gamesCompleted += 1;
      stats.totalPrizeMoney += finalPrize || 0;
      stats.questionsAnswered += questionsAnswered || 0;
      stats.accuracy = stats.questionsAnswered > 0 ? 
        Math.round((correctAnswers / stats.questionsAnswered) * 100) : 0;
      await stats.save();
    } else {
      const lastStat = await Stats.findOne().sort({ id: -1 });
      const newId = lastStat ? lastStat.id + 1 : 1;
      
      stats = new Stats({
        id: newId,
        userId: userId,
        username,
        gamesPlayed: 1,
        gamesCompleted: gameCompleted ? 1 : 0,
        totalPrizeMoney: finalPrize || 0,
        questionsAnswered: questionsAnswered || 0,
        accuracy: questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0,
        averageCompletionTime: completionTime || "0:00"
      });
      await stats.save();
    }
    
    // Add to leaderboard if significant prize
    if (finalPrize > 0) {
      let leaderboard = await Leaderboard.findOne({});
      if (!leaderboard) {
        leaderboard = new Leaderboard({ leaderboard: [] });
      }
      
      const lastEntry = leaderboard.leaderboard.length > 0 
        ? Math.max(...leaderboard.leaderboard.map(entry => entry.id))
        : 0;
      const newId = lastEntry + 1;
      
      const newEntry = {
        id: newId,
        userId: userId,
        playerName: username,
        prizeWon: finalPrize,
        questionsAnswered: questionsAnswered || 0,
        totalQuestions: totalQuestions || 16,
        completionDate: new Date(),
        completionTime: completionTime || "0:00"
      };
      
      leaderboard.leaderboard.push(newEntry);
      leaderboard.leaderboard.sort((a, b) => b.prizeWon - a.prizeWon);
      
      // Keep top 100 entries
      if (leaderboard.leaderboard.length > 100) {
        leaderboard.leaderboard = leaderboard.leaderboard.slice(0, 100);
      }
      
      await leaderboard.save();
      
      const leaderboardPosition = leaderboard.leaderboard.findIndex(entry => entry.id === newId) + 1;
      
      res.json({ 
        success: true, 
        message: 'Game results saved successfully',
        leaderboardPosition,
        stats: {
          gamesPlayed: stats.gamesPlayed,
          totalPrize: stats.totalPrizeMoney,
          accuracy: stats.accuracy
        }
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Game stats updated',
        stats: {
          gamesPlayed: stats.gamesPlayed,
          totalPrize: stats.totalPrizeMoney,
          accuracy: stats.accuracy
        }
      });
    }
  } catch (error) {
    logger.error('Error saving game results:', error);
    res.status(500).json({ error: 'Server error saving game results' });
  }
});

// API: Complete game and add to leaderboard (backwards compatibility)
app.post('/api/complete-game', async (req, res) => {
  try {
    const {
      userId,
      playerName,
      prizeWon,
      questionsAnswered,
      totalQuestions,
      completionTime
    } = req.body;

    // Find existing leaderboard or create new one
    let leaderboard = await Leaderboard.findOne({});
    if (!leaderboard) {
      leaderboard = new Leaderboard({ leaderboard: [] });
    }

    // Get next ID for leaderboard entry
    const lastEntry = leaderboard.leaderboard.length > 0 
      ? Math.max(...leaderboard.leaderboard.map(entry => entry.id))
      : 0;
    const newId = lastEntry + 1;

    // Create new leaderboard entry
    const newEntry = {
      id: newId,
      userId,
      playerName,
      prizeWon,
      questionsAnswered,
      totalQuestions,
      completionDate: new Date(),
      completionTime
    };

    // Add to leaderboard
    leaderboard.leaderboard.push(newEntry);

    // Sort by prize won (descending)
    leaderboard.leaderboard.sort((a, b) => b.prizeWon - a.prizeWon);

    // Keep top 100 entries
    if (leaderboard.leaderboard.length > 100) {
      leaderboard.leaderboard = leaderboard.leaderboard.slice(0, 100);
    }

    await leaderboard.save();

    res.json({ 
      success: true, 
      message: 'Game completed and added to leaderboard',
      leaderboardPosition: leaderboard.leaderboard.findIndex(entry => entry.id === newId) + 1
    });
  } catch (error) {
    logger.error('Error completing game:', error);
    res.status(500).json({ error: 'Server error completing game' });
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
    logger.error('Error fetching leaderboard:', error);
    
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
      leaderboard: '/api/leaderboard - Get game leaderboard (GET)',
      admin: '/admin - Admin dashboard (requires authentication)'
    }
  });
});

// Mount auth routes
app.use('/api', authRoutes);

// Mount user routes
app.use('/api/user', userRoutes);

// Mount admin routes
app.use('/admin', adminRoutes);

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
  logger.info(`QuizTime backend server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS Origin: ${process.env.CORS_ORIGIN || 'localhost'}`);
});
