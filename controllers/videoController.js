const { uploadVideoService } = require('../services/videoService');
const Video = require('../models/Video');
const { recordView } = require('../services/videoAnalyticsService');

exports.uploadVideo = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      type,
      category,
      tags,
      privacy,
      ageRestriction,
      videoUrl, // for direct upload (URL from frontend)
    } = req.body;

    const userId = req.user.id; // from auth middleware
    const thumbnailFile = req.files?.thumbnail?.[0]; // frontend suppose send am maybe via multer

    const result = await uploadVideoService({
      userId,
      title,
      description,
      price,
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

    // Build playback URL using muxPlaybackId
    const playbackUrl = video.muxPlaybackId
      ? `https://stream.mux.com/${video.muxPlaybackId}.m3u8`
      : null;

     // Record analytics
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    recordView({ videoId: id, userId, ipAddress });

    return res.status(200).json({
      ...video.dataValues,
      playbackUrl
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

    if (req.user.id !== userId)
      return res.status(403).json({ message: 'Unauthorized access.' });

    const videos = await Video.findAll({
      where: { userId },
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