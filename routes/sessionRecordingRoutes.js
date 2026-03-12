const express = require('express');
const router = express.Router();
const sessionRecordingController = require('../controllers/sessionRecordingController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');

/**
 * Session Recording Routes
 * All routes require admin authentication
 */

/**
 * Send test recording email
 * POST /api/admin/live-series/:seriesId/send-recording/test
 * 
 * Body: {
 *   recordings: [{ sessionNumber: 1, driveLink: "..." }],
 *   customMessage: "Optional message",
 *   testEmail: "test@example.com"
 * }
 */
router.post(
  '/:seriesId/send-recording/test',
  authenticateToken,
  isAdmin,
  sessionRecordingController.sendTestRecordingEmail
);

/**
 * Send recordings to all enrolled students
 * POST /api/admin/live-series/:seriesId/send-recording
 * 
 * Body: {
 *   recordings: [
 *     { sessionNumber: 1, driveLink: "..." },
 *     { sessionNumber: 2, driveLink: "..." }
 *   ],
 *   customMessage: "Optional message"
 * }
 */
router.post(
  '/:seriesId/send-recording',
  authenticateToken,
  isAdmin,
  sessionRecordingController.sendRecordingToStudents
);

/**
 * Get recording send history for a series
 * GET /api/admin/live-series/:seriesId/recording-history
 */
router.get(
  '/:seriesId/recording-history',
  authenticateToken,
  isAdmin,
  sessionRecordingController.getRecordingHistory
);

module.exports = router;
