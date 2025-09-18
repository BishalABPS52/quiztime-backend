# QuizTime Backend

Backend service for the QuizTime quiz application that provides questions by difficulty levels (easy, medium, hard), tracks user progress, and maintains leaderboards.

## Features

- Question API endpoints by difficulty level
- User tracking to avoid repeating questions
- Score and statistics tracking
- Leaderboard functionality
- Lifeline support

## API Endpoints

### Questions
- `POST /api/questions` - Get questions by level, avoiding repeats for user
- `POST /api/check-answer` - Verify if an answer is correct

### Lifelines
- `GET /api/lifelines` - Get available lifelines

### User Data
- `POST /api/score` - Save user score
- `GET /api/score/:username` - Get user score
- `POST /api/stats` - Save detailed game stats
- `GET /api/stats/:username` - Get user stats
- `GET /api/leaderboard` - Get global leaderboard

## Running the Server

```bash
npm install
npm start
```

The server will start on port 4000 (or the port specified in the PORT environment variable).

## Deployment

This repository is configured for deployment on Render using the `render.yaml` configuration file.