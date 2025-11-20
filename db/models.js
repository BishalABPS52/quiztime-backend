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
  category: {
    type: String,
    default: 'general'
  }
});

// User Schema
const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: false
  },
  userId: {
    type: String,
    required: true,
    unique: true
  },
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
  id: {
    type: Number,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  gamesCompleted: {
    type: Number,
    default: 0
  },
  totalPrizeMoney: {
    type: Number,
    default: 0
  },
  questionsAnswered: {
    type: Number,
    default: 0
  },
  accuracy: {
    type: Number,
    default: 0
  },
  averageCompletionTime: {
    type: String,
    default: "0:00"
  }
});

// Leaderboard Schema with entries array to match JSON structure
const leaderboardSchema = new mongoose.Schema({
  leaderboard: [{
    id: {
      type: Number,
      required: true
    },
    userId: {
      type: String,
      required: true
    },
    playerName: {
      type: String,
      required: true
    },
    prizeWon: {
      type: Number,
      required: true
    },
    questionsAnswered: {
      type: Number,
      default: 0
    },
    totalQuestions: {
      type: Number,
      default: 0
    },
    completionDate: {
      type: Date,
      required: true
    },
    completionTime: {
      type: Number,
      default: 0
    }
  }]
});

// Create and export models
const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Stats = mongoose.models.Stats || mongoose.model('Stats', statsSchema);
const Leaderboard = mongoose.models.Leaderboard || mongoose.model('Leaderboard', leaderboardSchema);

export { Question, User, Stats, Leaderboard };