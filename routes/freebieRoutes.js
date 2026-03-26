const express = require('express');
const router = express.Router();
const multer = require('multer');
const freebieController = require('../controllers/freebieController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Multer — memory storage, files go straight to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      if (IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
      return cb(new Error('Thumbnail must be JPEG, PNG, or WebP'));
    }
    if (file.fieldname === 'files') {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
      return cb(new Error(`File type not allowed: ${file.originalname}`));
    }
    cb(null, true);
  }
});

const uploadFields = upload.fields([
  { name: 'files', maxCount: 20 },
  { name: 'thumbnail', maxCount: 1 }
]);

// ── Public ──────────────────────────────────────────────────────────────────
router.get('/', freebieController.listFreebies);
router.get('/my', authMiddleware, freebieController.getMyFreebies);

// ── Admin analytics (must be before /:id to avoid route conflict) ────────────
router.get('/admin/analytics', authMiddleware, adminMiddleware, freebieController.getAnalytics);
router.get('/admin/items/:itemId/downloads', authMiddleware, adminMiddleware, freebieController.getItemDownloadLog);

// ── Admin delete ─────────────────────────────────────────────────────────────
router.delete('/items/:itemId', authMiddleware, adminMiddleware, freebieController.deleteItem);
router.delete('/:id', authMiddleware, adminMiddleware, freebieController.deleteFreebie);

// ── Public detail (after admin routes) ──────────────────────────────────────
router.get('/:id', freebieController.getFreebieById);

// ── Auth required ────────────────────────────────────────────────────────────
router.post('/', authMiddleware, uploadFields, freebieController.createFreebie);
router.post('/items/:itemId/download', authMiddleware, freebieController.downloadItem);

module.exports = router;