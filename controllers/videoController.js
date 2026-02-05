const { uploadVideoService } = require('../services/videoService');
const Video = require('../models/Video');
const { recordView } = require('../services/videoAnalyticsService');
const jwt = require('jsonwebtoken');

/**
 * Helper function to extract user from token (optional authentication)
 */
const extractUserFromToken = (req) => {
  try {
    // Try header first
    let token = req.header('Authorization')?.replace('Bearer ', '');
    // If not in header, try cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    return decoded;
  } catch (error) {
    return null;
  }
};

exports.uploadVideo = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      currency,
      type,
      category,
      tags,
      privacy,
      ageRestriction,
      videoUrl, // for direct upload (URL from frontend)
    } = req.body;

    const userId = req.user.id; // from auth middleware
    // Check multiple possible field names (thumbnail, thumbnailUrl, image, file)
    const thumbnailFile = req.files?.thumbnail?.[0] || req.files?.thumbnailUrl?.[0] || req.files?.image?.[0] || req.files?.file?.[0];

    const result = await uploadVideoService({
      userId,
      title,
      description,
      price,
      currency,
      type,
      category,
      tags: tags ? tags.split(',') : [],
      privacy,
      ageRestriction: ageRestriction === 'true',
      videoUrl,
      thumbnailFile,
    });

    res.status(201).json({
      success: true,
      message: 'Video upload initialized successfully',
      uploadUrl: result.uploadUrl,
      video: result.video,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getAllVideos = async (req, res) => {
  try {
    const { type, category, search } = req.query;

    const filters = {
      privacy: 'public',
      status: 'ready'
    };

    if (type) filters.type = type;
    if (category) filters.category = category;
    if (search)
      filters.title = { [Op.iLike]: `%${search}%` };

    const videos = await Video.findAll({
      where: filters,
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      count: videos.length,
      videos
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return res.status(500).json({ message: 'Server error fetching videos.' });
  }
};

// ============================
//  GET SINGLE VIDEO BY ID
// ============================
exports.getVideoById = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findOne({ where: { id } });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Privacy check (if you want private/unlisted logic)
    if (video.privacy === 'private') {
      const authUser = req.user;
      if (!authUser || authUser.id !== video.userId) {
        return res.status(403).json({ message: 'This video is private.' });
      }
    }

    // Access control check (handled by middleware)
    // If middleware passed, user has access
    if (!req.hasAccess) {
      // This shouldn't happen if middleware is properly configured
      return res.status(402).json({
        success: false,
        message: 'Payment required to access this video',
        requiresPayment: true,
        price: video.price
      });
    }

    // Build playback URL using muxPlaybackId (only if user has access)
    const playbackUrl = video.muxPlaybackId
      ? `https://stream.mux.com/${video.muxPlaybackId}.m3u8`
      : null;

    // Record analytics
    const user = req.user || extractUserFromToken(req);
    const userId = user ? user.id : null;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    recordView({ videoId: id, userId, ipAddress });

    return res.status(200).json({
      ...video.dataValues,
      playbackUrl,
      accessGranted: true,
      accessReason: req.accessReason,
      purchaseDate: req.purchaseDate || null
    });
  } catch (error) {
    console.error('Error fetching video by ID:', error);
    return res.status(500).json({ message: 'Server error fetching video.' });
  }
};

// ============================
//  GET VIDEOS BY USER (Creator dashboard)
// ============================
exports.getUserVideos = async (req, res) => {
  try {
    const { userId } = req.params;
    const userIdInt = parseInt(userId, 10);

    // Ensure userId from params matches authenticated user
    if (req.user.id !== userIdInt) {
      return res.status(403).json({ message: 'Unauthorized access.' });
    }

    const videos = await Video.findAll({
      where: { userId: userIdInt },
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      count: videos.length,
      videos
    });
  } catch (error) {
    console.error('Error fetching user videos:', error);
    return res.status(500).json({ message: 'Server error fetching user videos.' });
  }
};

// ============================
//  GET CURRENT USER'S VIDEOS (Convenience endpoint)
// ============================
exports.getMyVideos = async (req, res) => {
  try {
    const userId = req.user.id;

    const videos = await Video.findAll({
      where: { userId },
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      count: videos.length,
      videos
    });
  } catch (error) {
    console.error('Error fetching my videos:', error);
    return res.status(500).json({ message: 'Server error fetching videos.' });
  }
};