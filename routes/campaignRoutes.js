const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public — no auth required
router.post('/register', campaignController.registerForCampaign);

// Admin only — list all registrations
router.get('/registrations', authMiddleware, adminMiddleware, campaignController.getRegistrations);

module.exports = router;
