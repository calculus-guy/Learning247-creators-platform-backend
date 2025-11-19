const express = require('express');
const router = express.Router();
const liveController = require('../controllers/liveController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create', authMiddleware, liveController.createLiveClass);
router.post('/:id/add-host', authMiddleware, liveController.addHost);
router.post('/:id/add-attendee', authMiddleware, liveController.addAttendee);
router.get('/:id', authMiddleware, liveController.getLiveClassById);
router.get('/:id/playback', liveController.getPlayback);
router.get('/:id/hosts', authMiddleware, liveController.getHosts);
router.get('/:id/attendees', authMiddleware, liveController.getAttendees);

module.exports = router;
