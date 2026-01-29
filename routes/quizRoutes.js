const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middleware/authMiddleware');

// All quiz routes require authentication
router.use(authMiddleware);

// Profile management
router.post('/profile', quizController.createProfile);

// Lobby
router.get('/lobby', quizController.getLobby);

// Challenge system
router.post('/challenge', quizController.createChallenge);
router.post('/challenge/:id/cancel', quizController.cancelChallenge);
router.post('/challenge/:id/respond', quizController.respondToChallenge);

// Leaderboard and history
router.get('/leaderboard', quizController.getLeaderboard);
router.get('/history', quizController.getHistory);

module.exports = router;