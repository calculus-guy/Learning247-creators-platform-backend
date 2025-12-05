const express = require('express');
const router = express.Router();
const liveController = require('../controllers/liveController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkContentAccess } = require('../middleware/purchaseMiddleware');

// Get all live classes (public endpoint with optional filters)
router.get('/getLive', liveController.getAllLiveClasses);

router.post('/create', authMiddleware, liveController.createLiveClass);
router.post('/:id/add-host', authMiddleware, liveController.addHost);
router.post('/:id/add-attendee', authMiddleware, liveController.addAttendee);
router.get('/:id', checkContentAccess, liveController.getLiveClassById);
router.get('/:id/playback', checkContentAccess, liveController.getPlayback);
router.get('/:id/hosts', authMiddleware, liveController.getHosts);
router.get('/:id/attendees', authMiddleware, liveController.getAttendees);

module.exports = router;
