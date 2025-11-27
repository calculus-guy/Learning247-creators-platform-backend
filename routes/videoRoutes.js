const express = require('express');
const { uploadVideo,
    getAllVideos,
  getVideoById,
  getUserVideos,
  getMyVideos
 } = require('../controllers/videoController');
const { upload } = require('../utils/multerConfig');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/upload',
  authMiddleware,
  upload.fields([{ name: 'thumbnail', maxCount: 1 }]),
  uploadVideo
);

router.get('/', getAllVideos);             // public feed
router.get('/my-videos', authMiddleware, getMyVideos); // current user's videos
router.get('/user/:userId', authMiddleware, getUserVideos); // creator dashboard
router.get('/:id', getVideoById);          // single video + metadata

module.exports = router;