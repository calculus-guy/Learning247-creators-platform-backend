const express = require('express');
const router = express.Router();
const liveController = require('../controllers/liveController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkContentAccess } = require('../middleware/purchaseMiddleware');
const { upload } = require('../utils/multerConfig');

// Get all live classes (public endpoint with optional filters)
router.get('/getLive', liveController.getAllLiveClasses);

// Get user's own live classes (authenticated)
router.get('/my-classes', authMiddleware, liveController.getMyLiveClasses);

router.post('/create', authMiddleware, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'thumbnailUrl', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), liveController.createLiveClass);
router.post('/:id/add-host', authMiddleware, liveController.addHost);
router.post('/:id/add-attendee', authMiddleware, liveController.addAttendee);
router.get('/:id', checkContentAccess, liveController.getLiveClassById);
router.get('/:id/playback', checkContentAccess, liveController.getPlayback);
router.get('/:id/hosts', authMiddleware, liveController.getHosts);
router.get('/:id/attendees', authMiddleware, liveController.getAttendees);

// ZegoCloud specific routes
router.post('/:id/start-zegocloud', authMiddleware, liveController.startZegoCloudSession);
router.post('/:id/end-zegocloud', authMiddleware, liveController.endZegoCloudSession);

module.exports = router;