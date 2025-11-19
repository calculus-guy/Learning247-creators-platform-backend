const LiveClass = require('../models/liveClass');
const LiveHost = require('../models/liveHost');
const LiveAttendee = require('../models/liveAttendee');
const muxLiveService = require('../services/muxLiveService');
const User = require('../models/User');
// createLiveClass, addHost, addAttendee, getLiveClassById, getPlayback, getHosts, getAttendees

exports.createLiveClass = async (req, res) => {
  try {
    const { title, description, price, thumbnailUrl, startTime, endTime, privacy } = req.body;
    const userId = req.user.id; // assumed from auth middleware
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
      status: 'scheduled',
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.addHost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;
    const exists = await LiveHost.findOne({ where: { liveClassId: id, userId } });
    if (exists) return res.status(400).json({ message: 'Host already exists.' });
    const host = await LiveHost.create({
      liveClassId: id,
      userId,
      role: role || 'cohost'
    });
    return res.json({ success: true, host });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
    return res.status(500).json({ message: error.message });
  }
};

exports.getLiveClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const live = await LiveClass.findByPk(id);
    if (!live) return res.status(404).json({ message: 'Live class not found.' });
    return res.json(live);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPlayback = async (req, res) => {
  try {
    const { id } = req.params;
    const live = await LiveClass.findByPk(id);
    if (!live) return res.status(404).json({ message: 'Live class not found.' });
    const url = muxLiveService.generatePlaybackUrl(live.mux_playback_id);
    return res.json({ playbackUrl: url });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getHosts = async (req, res) => {
  try {
    const { id } = req.params;
    const hosts = await LiveHost.findAll({ where: { liveClassId: id }, include: [User] });
    return res.json({ hosts });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getAttendees = async (req, res) => {
  try {
    const { id } = req.params;
    const attendees = await LiveAttendee.findAll({ where: { liveClassId: id }, include: [User] });
    return res.json({ attendees });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
