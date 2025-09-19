// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('quiztime');

// Questions collection queries
// Count questions by level
db.getCollection('questions').count();
db.getCollection('questions').count({ level: 'easy' });
db.getCollection('questions').count({ level: 'medium' });
db.getCollection('questions').count({ level: 'hard' });

// Sample questions from each level
db.getCollection('questions').findOne({ level: 'easy' });
db.getCollection('questions').findOne({ level: 'medium' });
db.getCollection('questions').findOne({ level: 'hard' });

// Check if users exist
db.getCollection('users').count();
db.getCollection('users').find().limit(3);

// Check if stats exist
db.getCollection('stats').count();
db.getCollection('stats').find().limit(3);

// Check if leaderboard exists
db.getCollection('leaderboards').count();
db.getCollection('leaderboards').find().limit(1);