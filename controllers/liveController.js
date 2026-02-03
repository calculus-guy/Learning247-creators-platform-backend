const { LiveClass, LiveHost, LiveAttendee } = require('../models/liveIndex');
const muxLiveService = require('../services/muxLiveService');
const User = require('../models/User');

// --- HELPER: Centralized Error Handler ---
// This translates database/code errors into Frontend-friendly messages
const handleError = (res, error) => {
  console.error("❌ Backend Error:", error); // Keep logs for yourself

  // 1. Sequelize Validation Errors (e.g. Missing fields, Wrong ENUM values)
  if (error.name === 'SequelizeValidationError') {
    const messages = error.errors.map(e => e.message);
    return res.status(400).json({ 
      success: false, 
      message: 'Validation Error', 
      errors: messages // Returns ["Status must be 'scheduled'", "Title is required"]
    });
  }

  // 2. Database/Enum Errors (Postgres specific)
  if (error.name === 'SequelizeDatabaseError') {
    // Detect invalid input syntax for types (like UUIDs or Enums)
    if (error.parent && error.parent.code === '22P02') {
       return res.status(400).json({ success: false, message: 'Invalid data format provided (check UUIDs or Enums).' });
    }
    // Handle ENUM violations that bypass Sequelize validation
    if (error.message.includes('invalid input value for enum')) {
       return res.status(400).json({ success: false, message: 'Invalid value provided for an enum field.' });
    }
  }

  // 3. Unique Constraint Errors (e.g. User already registered)
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'Duplicate entry: This record already exists.' });
  }

  // 4. Mux Service Errors
  if (error.name === 'MuxError' || (error.status && error.status >= 400 && error.status < 500)) {
     return res.status(error.status || 502).json({ success: false, message: `Video Service Error: ${error.message}` });
  }

  // 5. Default Server Error
  return res.status(500).json({ success: false, message: 'Internal Server Error. Please try again later.' });
};


exports.createLiveClass = async (req, res) => {
  try {
    const { title, description, price, currency, category, thumbnailUrl, startTime, endTime, privacy, streamingProvider = 'mux' } = req.body;
    const userId = req.user.id;
    
    // Handle thumbnail - either from file upload or URL string
    const thumbnailFile = req.files?.thumbnail?.[0];
    const finalThumbnailUrl = thumbnailFile ? `/uploads/${thumbnailFile.filename}` : thumbnailUrl || null; 

    // Basic check before calling services
    if (!title) return res.status(400).json({ success: false, message: "Title is required" });

    // Validate currency if provided
    const validCurrencies = ['NGN', 'USD'];
    const finalCurrency = currency && validCurrencies.includes(currency.toUpperCase()) 
      ? currency.toUpperCase() 
      : 'NGN';

    // Validate streaming provider
    if (!['mux', 'zegocloud'].includes(streamingProvider)) {
      return res.status(400).json({ success: false, message: "Invalid streaming provider. Must be 'mux' or 'zegocloud'" });
    }

    let streamingDetails = {};

    if (streamingProvider === 'zegocloud') {
      // Step 1b: Prepare for ZegoCloud (room will be created when going live)
      streamingDetails = {
        streaming_provider: 'zegocloud',
        // ZegoCloud fields will be populated when creator starts the live session
        zego_room_id: null,
        zego_app_id: null,
        zego_room_token: null,
        max_participants: req.body.maxParticipants || 50
      };
    }
    
    else if (streamingProvider === 'mux') {
      // Step 1a: Create Mux live stream
      const muxDetails = await muxLiveService.createLiveStream({ title, passthrough: '' });
      streamingDetails = {
        streaming_provider: 'mux',
        mux_stream_id: muxDetails.mux_stream_id,
        mux_stream_key: muxDetails.mux_stream_key,
        mux_rtmp_url: muxDetails.mux_rtmp_url,
        mux_playback_id: muxDetails.mux_playback_id
      };
    } 

    // Step 2: Create LiveClass row
    const liveClass = await LiveClass.create({
      userId,
      title,
      description,
      price,
      currency: finalCurrency,
      category,
      thumbnailUrl: finalThumbnailUrl,
      startTime,
      endTime,
      privacy,
      status: 'scheduled', // Ensure this matches your Enum definition exactly
      ...streamingDetails
    });

    // Step 3: Add creator as primary host
    await LiveHost.create({
      liveClassId: liveClass.id,
      userId,
      role: 'creator'
    });

    return res.json({ 
      success: true, 
      liveClass: {
        ...liveClass.dataValues,
        // Include helpful info for frontend
        streamingProvider: liveClass.streaming_provider,
        isZegoCloud: liveClass.streaming_provider === 'zegocloud',
        isMux: liveClass.streaming_provider === 'mux'
      }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.addHost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    // Check constraint manually to return clean message
    const exists = await LiveHost.findOne({ where: { liveClassId: id, userId } });
    if (exists) return res.status(400).json({ message: 'Host already exists.' });

    const host = await LiveHost.create({
      liveClassId: id,
      userId,
      role: role || 'cohost'
    });
    return res.json({ success: true, host });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.addAttendee = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, invitedBy, statusPaid } = req.body;

    const attendee = await LiveAttendee.create({
      liveClassId: id,
      userId,
      invitedBy: invitedBy || null,
      statusPaid: statusPaid || false
    });
    return res.json({ success: true, attendee });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getLiveClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const live = await LiveClass.findByPk(id);
    if (!live) return res.status(404).json({ message: 'Live class not found.' });
    
    // Access control check (handled by middleware)
    if (!req.hasAccess) {
      return res.status(402).json({
        success: false,
        message: 'Payment required to access this live class',
        requiresPayment: true,
        price: live.price
      });
    }

    // ✅ Add streaming provider info for frontend
    const response = {
      ...live.dataValues,
      accessGranted: true,
      accessReason: req.accessReason,
      purchaseDate: req.purchaseDate || null,
      // ✅ Helper flags for frontend
      isZegoCloud: live.streaming_provider === 'zegocloud',
      isMux: live.streaming_provider === 'mux'
    };

    return res.json(response);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getPlayback = async (req, res) => {
  try {
    const { id } = req.params;
    const live = await LiveClass.findByPk(id);
    
    if (!live) return res.status(404).json({ message: 'Live class not found.' });
    
    // Access control check (handled by middleware)
    if (!req.hasAccess) {
      return res.status(402).json({
        success: false,
        message: 'Payment required to access this live class',
        requiresPayment: true,
        price: live.price
      });
    }

    // ✅ ONLY check playback ID for Mux streams
    if (live.streaming_provider === 'mux') {
      if (!live.mux_playback_id) {
        return res.status(400).json({ message: 'Playback ID not generated yet.' });
      }
      const url = muxLiveService.generatePlaybackUrl(live.mux_playback_id);
      return res.json({ 
        playbackUrl: url,
        accessGranted: true,
        accessReason: req.accessReason
      });
    }

    // ✅ For ZegoCloud, redirect to join-room endpoint
    if (live.streaming_provider === 'zegocloud') {
      return res.status(400).json({
        success: false,
        message: 'ZegoCloud streams use real-time joining. Use /api/live/zegocloud/join-room instead.',
        redirectTo: `/api/live/zegocloud/join-room`,
        liveClassId: live.id
      });
    }

    return res.status(400).json({ message: 'Unknown streaming provider.' });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getHosts = async (req, res) => {
  try {
    const { id } = req.params;
    const hosts = await LiveHost.findAll({ where: { liveClassId: id }, include: [User] });
    return res.json({ hosts });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAttendees = async (req, res) => {
  try {
    const { id } = req.params;
    const attendees = await LiveAttendee.findAll({ where: { liveClassId: id }, include: [User] });
    return res.json({ attendees });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Start ZegoCloud live session
 * POST /live/:id/start-zegocloud
 */
exports.startZegoCloudSession = async (req, res) => {
  try {
    const { id: liveClassId } = req.params;
    const userId = req.user.id;

    // Get live class details
    const liveClass = await LiveClass.findByPk(liveClassId);
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Only creator can start the session
    if (liveClass.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can start the live session'
      });
    }

    // Must be a ZegoCloud live class
    if (liveClass.streaming_provider !== 'zegocloud') {
      return res.status(400).json({
        success: false,
        message: 'This live class is not configured for ZegoCloud streaming'
      });
    }

    // Check if already live
    if (liveClass.status === 'live') {
      // ✅ Generate fresh token for creator instead of using stored one
      const { zegoCloudService } = require('../services/zegoCloudService');
      const freshToken = zegoCloudService.generateToken(liveClass.zego_room_id, userId, 'host');
      
      return res.status(409).json({
        success: false,
        message: 'Live class is already active',
        data: {
          roomId: liveClass.zego_room_id,
          appId: liveClass.zego_app_id,
          creatorToken: freshToken // ✅ Fresh token, not stored one
        }
      });
    }

    // Import ZegoCloud service
    const { zegoCloudService } = require('../services/zegoCloudService');

    // Start the live session
    const sessionResult = await zegoCloudService.startLiveSession(liveClassId, userId, {
      maxParticipants: liveClass.max_participants,
      privacy: liveClass.privacy
    });

    return res.status(200).json({
      success: true,
      message: 'ZegoCloud live session started successfully',
      data: {
        liveClassId: sessionResult.liveClassId,
        roomId: sessionResult.roomId,
        appId: sessionResult.appId,
        creatorToken: sessionResult.creatorToken,
        sessionStartedAt: sessionResult.sessionStartedAt,
        liveClass: {
          id: liveClass.id,
          title: liveClass.title,
          description: liveClass.description,
          privacy: liveClass.privacy,
          maxParticipants: liveClass.max_participants
        }
      }
    });

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * End ZegoCloud live session
 * POST /live/:id/end-zegocloud
 */
exports.endZegoCloudSession = async (req, res) => {
  try {
    const { id: liveClassId } = req.params;
    const userId = req.user.id;

    // Get live class details
    const liveClass = await LiveClass.findByPk(liveClassId);
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Only creator can end the session
    if (liveClass.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can end the live session'
      });
    }

    // Must be a ZegoCloud live class
    if (liveClass.streaming_provider !== 'zegocloud') {
      return res.status(400).json({
        success: false,
        message: 'This live class is not configured for ZegoCloud streaming'
      });
    }

    // Import ZegoCloud service
    const { zegoCloudService } = require('../services/zegoCloudService');

    // End the live session
    const endResult = await zegoCloudService.endLiveSession(liveClassId, 'creator_ended');

    return res.status(200).json({
      success: true,
      message: 'ZegoCloud live session ended successfully',
      data: {
        liveClassId: endResult.liveClassId,
        endedAt: endResult.endedAt,
        reason: endResult.reason
      }
    });

  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAllLiveClasses = async (req, res) => {
  try {
    const { status, privacy, category, showAll } = req.query;
    
    const filters = {};
    
    // Filter by privacy if provided (default to public for unauthenticated users)
    if (privacy) {
      filters.privacy = privacy;
    } else {
      filters.privacy = 'public'; // Only show public classes by default
    }
    
    // 🎯 KEY CHANGE: Default to only show active classes for better UX
    if (status) {
      // If specific status requested, use it
      filters.status = status;
    } else if (!showAll || showAll !== 'true') {
      // Default: Only show scheduled and live classes (hide ended/recorded)
      // Use Sequelize Op.in for array filtering
      const { Op } = require('sequelize');
      filters.status = { [Op.in]: ['scheduled', 'live'] };
    }
    // If showAll=true is passed, show everything (for admin/creator views)
    
    // Filter by category if provided
    if (category) filters.category = category;

    const liveClasses = await LiveClass.findAll({
      where: filters,
      order: [['startTime', 'ASC']],
      include: [
        {
          model: LiveHost,
          as: 'hosts',
          include: [{ model: User, attributes: ['id', 'firstname', 'lastname', 'email'] }]
        }
      ]
    });

    // The status is managed by Mux webhooks for Mux streams:
    // - "scheduled" = created but not streaming yet
    // - "live" = actively streaming (set by webhook: video.live_stream.active)
    // - "ended" = stream stopped (set by webhook: video.live_stream.idle)
    // - "recorded" = recording available (set by webhook: video.live_stream.completed)
    
    // For ZegoCloud streams, status is managed by our service:
    // - "scheduled" = created but not started yet
    // - "live" = ZegoCloud room is active
    // - "ended" = ZegoCloud session ended

    // 📊 UX Enhancement: By default, only 'scheduled' and 'live' classes are shown
    // This keeps the frontend clean and focused on actionable content
    // Use ?showAll=true to see ended/recorded classes (for creators/admins)

    return res.json({
      count: liveClasses.length,
      liveClasses
    });
  } catch (error) {
    return handleError(res, error);
  }
};