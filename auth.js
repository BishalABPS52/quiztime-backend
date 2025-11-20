import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import winston from 'winston';
import { User } from './db/models.js';

dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const router = express.Router();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  throw new Error('JWT_SECRET environment variable is required');
}

if (process.env.JWT_SECRET.length < 64) {
  logger.warn('JWT_SECRET should be at least 64 characters for security');
}

const JWT_SECRET = process.env.JWT_SECRET;

// Configure email transporter with environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  logger.warn('Email configuration missing - email features will be disabled');
}

const transporter = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD ? nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
}) : null;

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register new user
router.post('/register/', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Generate verification code (for future use)
    const verification_code = generateVerificationCode();

    // Generate unique userId
    const userId = `qt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with proper email verification
    const newUser = new User({
      userId,
      username,
      email,
      password: hashedPassword,
      verification_code,
      is_verified: false, // Require email verification for security
    });

    await newUser.save();

    // Send verification email
    let emailSent = false;
    if (transporter && process.env.EMAIL_PASSWORD !== 'jmlo zlum jpjl gdsl') {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'QuizTime - Verify Your Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Welcome to QuizTime!</h2>
            <p>Thank you for registering. Please verify your email address to complete registration.</p>
            <p><strong>Verification Code: ${verification_code}</strong></p>
            <p>Enter this code on the verification page to activate your account.</p>
            <p>Your username: <strong>${username}</strong></p>
            <p>Happy Quizzing!</p>
            <p style="margin-top: 30px; font-size: 12px; color: #6B7280;">© QuizTime Team</p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        logger.info(`Verification email sent to ${email}`);
        emailSent = true;
      } catch (emailError) {
        logger.error('Email sending failed:', emailError);
        // Continue with registration even if email fails
      }
    } else {
      logger.warn('Email not configured properly - verification code will be shown in response');
    }

    res.status(201).json({
      message: emailSent 
        ? 'Registration successful. Please check your email for verification code.'
        : 'Registration successful. Email not configured - use verification code below.',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        isVerified: newUser.is_verified
      },
      // Include verification code in response when email is not sent
      ...(emailSent ? {} : { verificationCode: verification_code, 
          developmentNote: 'Email not configured. Use this code for verification.' })
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Verify email
router.post('/verify-email/', async (req, res) => {
  try {
    const { email, code } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({ message: 'Please provide email and verification code' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Check verification code
    if (user.verification_code !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Update user verification status
    user.is_verified = true;
    user.verification_code = undefined; // Clear code after verification
    await user.save();

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// Login
router.post('/login/', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Login attempt with non-existent email: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      logger.warn(`Invalid password attempt for user: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is verified
    if (!user.is_verified) {
      logger.warn(`Login attempt by unverified user: ${user.email}`);
      return res.status(401).json({ 
        message: 'Please verify your email before logging in',
        requiresVerification: true 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last activity
    user.lastActivity = new Date();
    await user.save();

    logger.info(`Successful login for user: ${user.username}`);
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      message: 'Login successful',
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});


// Middleware to protect routes (require authentication)
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

export default router;