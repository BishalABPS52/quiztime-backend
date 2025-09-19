import mongoose from 'mongoose';

// Question Schema
const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  level: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard']
  },
  category: {
    type: String,
    default: 'general'
  }
});

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  is_verified: {
    type: Boolean,
    default: false
  },
  verification_code: {
    type: String
  },
  score: {
    type: Number,
    default: 0
  },
  questionsAnswered: {
    type: [String], // Array of question IDs
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Stats Schema
const statsSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  score: {
    type: Number,
    default: 0
  },
  questionsAnswered: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  wrongAnswers: {
    type: Number,
    default: 0
  },
  averageTimePerQuestion: {
    type: Number,
    default: 0
  },
  totalTime: {
    type: Number,
    default: 0
  },
  level: {
    type: String,
    default: 'easy'
  },
  lifelinesUsed: {
    type: Object,
    default: {}
  },
  lastPlayed: {
    type: Date,
    default: Date.now
  }
});

// Leaderboard Entry Schema
const leaderboardSchema = new mongoose.Schema({
  entries: [{
    username: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true
    },
    questionsAnswered: {
      type: Number,
      default: 0
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    averageTimePerQuestion: {
      type: Number,
      default: 0
    },
    totalTime: {
      type: Number,
      default: 0
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
});

// Create and export models
const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Stats = mongoose.models.Stats || mongoose.model('Stats', statsSchema);
const Leaderboard = mongoose.models.Leaderboard || mongoose.model('Leaderboard', leaderboardSchema);

export { Question, User, Stats, Leaderboard };