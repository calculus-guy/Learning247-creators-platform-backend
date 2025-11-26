const LiveClass = require('../models/liveClass');
const LiveHost = require('../models/liveHost');
const LiveAttendee = require('../models/liveAttendee');
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
    const { title, description, price, thumbnailUrl, startTime, endTime, privacy } = req.body;
    const userId = req.user.id; 

    // Basic check before calling services
    if (!title) return res.status(400).json({ success: false, message: "Title is required" });

    // Step 1: Create Mux live stream
    const muxDetails = await muxLiveService.createLiveStream({ title, passthrough: '' });

    // Step 2: Create LiveClass row
    const liveClass = await LiveClass.create({
      userId,
      title,
      description,
      price,
      thumbnailUrl,
      startTime,
      endTime,
      privacy,
      status: 'scheduled', // Ensure this matches your Enum definition exactly
      mux_stream_id: muxDetails.mux_stream_id,
      mux_stream_key: muxDetails.mux_stream_key,
      mux_rtmp_url: muxDetails.mux_rtmp_url,
      mux_playback_id: muxDetails.mux_playback_id
    });

    // Step 3: Add creator as primary host
    await LiveHost.create({
      liveClassId: liveClass.id,
      userId,
      role: 'creator'
    });

    return res.json({ success: true, liveClass });
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
    return res.json(live);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getPlayback = async (req, res) => {
  try {
    const { id } = req.params;
    const live = await LiveClass.findByPk(id);
    
    if (!live) return res.status(404).json({ message: 'Live class not found.' });
    if (!live.mux_playback_id) return res.status(400).json({ message: 'Playback ID not generated yet.' });

    const url = muxLiveService.generatePlaybackUrl(live.mux_playback_id);
    return res.json({ playbackUrl: url });
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