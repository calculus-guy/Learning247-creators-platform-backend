const express = require('express');
const { uploadVideo,
    getAllVideos,
  getVideoById,
  getUserVideos
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
router.get('/:id', getVideoById);          // single video + metadata
router.get('/user/:userId', authMiddleware, getUserVideos); // creator dashboard

module.exports = router;