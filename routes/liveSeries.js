const express = require('express');
const router = express.Router();
const liveSeriesController = require('../controllers/liveSeriesController');
const liveSessionController = require('../controllers/liveSessionController');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../utils/multerConfig');

// ============================================
// SERIES ROUTES
// ============================================

/**
 * Create a new live series
 * POST /api/live/series/create
 * Auth: Required (Creator)
 */
router.post('/create', authMiddleware, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'thumbnailUrl', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), liveSeriesController.createSeries);

/**
 * Get all public live series
 * GET /api/live/series
 * Auth: Optional
 */
router.get('/', liveSeriesController.getAllSeries);

/**
 * Get creator's own series
 * GET /api/live/series/my-series
 * Auth: Required (Creator)
 */
router.get('/my-series', authMiddleware, liveSeriesController.getMySeries);

/**
 * Get series by ID
 * GET /api/live/series/:id
 * Auth: Optional
 */
router.get('/:id', liveSeriesController.getSeriesById);

/**
 * Get all sessions for a series
 * GET /api/live/series/:id/sessions
 * Auth: Optional
 */
router.get('/:id/sessions', liveSeriesController.getSeriesSessions);

/**
 * Update series
 * PUT /api/live/series/:id
 * Auth: Required (Creator)
 */
router.put('/:id', authMiddleware, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'thumbnailUrl', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), liveSeriesController.updateSeries);

/**
 * Cancel series
 * DELETE /api/live/series/:id
 * Auth: Required (Creator)
 */
router.delete('/:id', authMiddleware, liveSeriesController.cancelSeries);

// ============================================
// SESSION ROUTES
// ============================================

/**
 * Get upcoming sessions for authenticated user
 * GET /api/live/session/upcoming
 * Auth: Required
 */
router.get('/session/upcoming', authMiddleware, liveSessionController.getUpcomingSessions);

/**
 * Start a session
 * POST /api/live/session/:id/start
 * Auth: Required (Creator)
 */
router.post('/session/:id/start', authMiddleware, liveSessionController.startSession);

/**
 * End a session
 * POST /api/live/session/:id/end
 * Auth: Required (Creator)
 */
router.post('/session/:id/end', authMiddleware, liveSessionController.endSession);

/**
 * Join a session
 * POST /api/live/session/:id/join
 * Auth: Required (Student)
 */
router.post('/session/:id/join', authMiddleware, liveSessionController.joinSession);

/**
 * Get session by ID
 * GET /api/live/session/:id
 * Auth: Optional
 */
router.get('/session/:id', liveSessionController.getSessionById);

module.exports = router;
