import express from 'express';
import { authenticateToken } from './auth.js';
import { User, Stats } from './db/models.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('-password -verification_code');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user stats
    const stats = await Stats.findOne({ username: user.username });
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        lastActivity: user.lastActivity
      },
      stats: stats ? {
        score: stats.score,
        questionsAnswered: stats.questionsAnswered,
        correctAnswers: stats.correctAnswers,
        wrongAnswers: stats.wrongAnswers,
        averageTimePerQuestion: stats.averageTimePerQuestion,
        totalTime: stats.totalTime,
        level: stats.level,
        lastPlayed: stats.lastPlayed
      } : null
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});

// Update user profile
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if username is already taken
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

export default router;