import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  // Get the Authorization header from the request
  const authHeader = req.headers.authorization;
  
  // Check if the Authorization header exists
  if (!authHeader) {
    return res.status(401).send(`
      <html>
        <head><title>Authentication Required</title>
        <style>
          body {
            font-family: sans-serif;
            max-width: 500px;
            margin: 100px auto;
            padding: 20px;
            text-align: center;
            background-color: #f8f9fa;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          h1 { color: #1a73e8; }
          p { margin-bottom: 20px; }
          a {
            display: inline-block;
            background-color: #1a73e8;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
          }
        </style>
        </head>
        <body>
          <h1>Authentication Required</h1>
          <p>You need to be logged in to access the admin area.</p>
          <a href="/webquiztime/admin">Go to Login</a>
        </body>
      </html>
    `);
  }
  
  // Extract the token from the Authorization header
  // Format: "Bearer TOKEN"
  const token = authHeader.split(' ')[1];
  
  // In a real implementation, you would validate the JWT token
  // For this example, we'll use a simple check
  // This should be replaced with proper JWT verification in production
  if (token !== 'temp-demo-token' && token !== 'admin-secret-token') {
    return res.status(403).send(`
      <html>
        <head><title>Access Denied</title>
        <style>
          body {
            font-family: sans-serif;
            max-width: 500px;
            margin: 100px auto;
            padding: 20px;
            text-align: center;
            background-color: #f8f9fa;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          h1 { color: #ea4335; }
          p { margin-bottom: 20px; }
          a {
            display: inline-block;
            background-color: #1a73e8;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
          }
        </style>
        </head>
        <body>
          <h1>Access Denied</h1>
          <p>Invalid authentication token.</p>
          <a href="/webquiztime/admin">Return to Login</a>
        </body>
      </html>
    `);
  }
  
  // If authentication is successful, proceed to the next middleware/route handler
  next();
};

// Admin dashboard HTML template
const adminTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QuizTime Admin Backend</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1, h2, h3 {
            color: #1a73e8;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 1px solid #e1e4e8;
            padding-bottom: 10px;
        }
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .tab-button {
            padding: 10px 20px;
            background-color: #f1f3f4;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
        .tab-button.active {
            background-color: #1a73e8;
            color: white;
        }
        .tab-content {
            background-color: #fff;
            border-radius: 4px;
            padding: 20px;
            min-height: 300px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #e1e4e8;
        }
        th {
            background-color: #f1f3f4;
            font-weight: 500;
        }
        .badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 50px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-easy {
            background-color: #e6f4ea;
            color: #137333;
        }
        .badge-medium {
            background-color: #fef7e0;
            color: #b06000;
        }
        .badge-hard {
            background-color: #fce8e6;
            color: #c5221f;
        }
        .actions {
            display: flex;
            gap: 10px;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
        .btn-primary {
            background-color: #1a73e8;
            color: white;
        }
        .btn-danger {
            background-color: #ea4335;
            color: white;
        }
        .btn-success {
            background-color: #0f9d58;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>QuizTime Administration</h1>
            <div>
                <button class="btn-primary">Refresh Data</button>
                <button class="btn-success">Export Data</button>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab-button active" onclick="showTab('users')">Users</button>
            <button class="tab-button" onclick="showTab('questions')">Questions</button>
            <button class="tab-button" onclick="showTab('leaderboard')">Leaderboard</button>
            <button class="tab-button" onclick="showTab('status')">System Status</button>
        </div>
        
        <div id="users" class="tab-content">
            <h2>User Management</h2>
            <p>Total Users: <strong id="user-count">Loading...</strong></p>
            <table id="users-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Registered Date</th>
                        <th>Games Played</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="5">Loading user data...</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div id="questions" class="tab-content" style="display: none;">
            <h2>Question Management</h2>
            <p>Total Questions: <strong id="question-count">Loading...</strong></p>
            <table id="questions-table">
                <thead>
                    <tr>
                        <th>Question</th>
                        <th>Category</th>
                        <th>Difficulty</th>
                        <th>Usage</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="5">Loading question data...</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div id="leaderboard" class="tab-content" style="display: none;">
            <h2>Leaderboard Management</h2>
            <p>Total Entries: <strong id="leaderboard-count">Loading...</strong></p>
            <table id="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Username</th>
                        <th>Score</th>
                        <th>Date</th>
                        <th>Difficulty</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="6">Loading leaderboard data...</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div id="status" class="tab-content" style="display: none;">
            <h2>System Status</h2>
            <div id="status-indicators">
                <p>Database Connection: <span id="db-status">Checking...</span></p>
                <p>API Status: <span id="api-status">Checking...</span></p>
                <p>Cache Status: <span id="cache-status">Checking...</span></p>
                <p>Server Load: <span id="server-load">Checking...</span></p>
            </div>
            <h3>Recent Logs</h3>
            <pre id="logs" style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; overflow: auto; max-height: 300px;">
Loading logs...
            </pre>
        </div>
    </div>

    <script>
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.style.display = 'none';
            });
            
            // Show the selected tab
            document.getElementById(tabName).style.display = 'block';
            
            // Update active tab button
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });
            
            // Find the button that was clicked and add the active class
            event.target.classList.add('active');
            
            // Load data for the tab
            loadTabData(tabName);
        }
        
        function loadTabData(tabName) {
            // This function would make API calls to load data for each tab
            console.log('Loading data for tab:', tabName);
            
            // Example placeholder - in a real app, this would fetch data from your API
            fetch('/admin/api/' + tabName)
                .then(response => response.json())
                .then(data => {
                    // Update the UI with the fetched data
                    console.log('Data loaded:', data);
                    updateUI(tabName, data);
                })
                .catch(error => {
                    console.error('Error loading data:', error);
                });
        }
        
        function updateUI(tabName, data) {
            // This is a placeholder - in a real app, this would update the UI
            // with the data fetched from your API
            console.log('Updating UI for tab:', tabName);
            
            // Example placeholder - this would be replaced with real data handling
            if (tabName === 'users') {
                document.getElementById('user-count').textContent = 'Placeholder for user count';
            } else if (tabName === 'questions') {
                document.getElementById('question-count').textContent = 'Placeholder for question count';
            } else if (tabName === 'leaderboard') {
                document.getElementById('leaderboard-count').textContent = 'Placeholder for leaderboard count';
            } else if (tabName === 'status') {
                document.getElementById('db-status').textContent = 'Connected';
                document.getElementById('api-status').textContent = 'Online';
                document.getElementById('cache-status').textContent = 'Active';
                document.getElementById('server-load').textContent = 'Low';
                document.getElementById('logs').textContent = 'No recent logs available.';
            }
        }
        
        // Initialize the first tab
        document.addEventListener('DOMContentLoaded', () => {
            loadTabData('users');
        });
    </script>
</body>
</html>
`;

// Routes for admin dashboard
router.get('/', authenticateAdmin, (req, res) => {
    res.send(adminTemplate);
});

// API endpoints for admin data
router.get('/api/users', authenticateAdmin, (req, res) => {
    // This would fetch real user data from the database
    res.json({
        success: true,
        users: [
            {
                username: 'user1',
                registeredDate: '2023-01-15T00:00:00Z',
                gamesPlayed: 12,
                status: 'active'
            },
            {
                username: 'user2',
                registeredDate: '2023-02-20T00:00:00Z',
                gamesPlayed: 8,
                status: 'active'
            },
            {
                username: 'user3',
                registeredDate: '2023-03-10T00:00:00Z',
                gamesPlayed: 3,
                status: 'inactive'
            }
        ]
    });
});

router.get('/api/questions', authenticateAdmin, (req, res) => {
    // This would fetch real question data from the database
    res.json({
        success: true,
        questions: [
            {
                id: '1',
                question: 'What is the capital of France?',
                category: 'Geography',
                difficulty: 'easy',
                usageCount: 42
            },
            {
                id: '2',
                question: 'Which element has the chemical symbol Au?',
                category: 'Science',
                difficulty: 'medium',
                usageCount: 28
            },
            {
                id: '3',
                question: 'What is the time complexity of quicksort in worst case?',
                category: 'Technology',
                difficulty: 'hard',
                usageCount: 15
            }
        ]
    });
});

router.get('/api/leaderboard', authenticateAdmin, (req, res) => {
    // This would fetch real leaderboard data from the database
    res.json({
        success: true,
        leaderboard: [
            {
                rank: 1,
                username: 'quiz_master',
                score: 1250000,
                date: '2023-05-10T15:23:48Z',
                difficulty: 'hard'
            },
            {
                rank: 2,
                username: 'trivia_fan',
                score: 980000,
                date: '2023-05-12T09:12:33Z',
                difficulty: 'medium'
            },
            {
                rank: 3,
                username: 'gaming_guru',
                score: 850000,
                date: '2023-05-08T18:45:22Z',
                difficulty: 'medium'
            }
        ]
    });
});

router.get('/api/status', authenticateAdmin, (req, res) => {
    // This would return real system status information
    res.json({
        success: true,
        status: {
            database: 'connected',
            api: 'online',
            cache: 'active',
            serverLoad: 'low'
        },
        logs: []
    });
});

export default router;