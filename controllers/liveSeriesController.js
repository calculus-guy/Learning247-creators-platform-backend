const { LiveSeries, LiveSession } = require('../models/liveSeriesIndex');
const liveSeriesService = require('../services/liveSeriesService');
const User = require('../models/User');
const { Op } = require('sequelize');

/**
 * Create a new live series
 * POST /api/live/series/create
 */
exports.createSeries = async (req, res) => {
  try {
    let {
      title,
      description,
      price,
      currency,
      category,
      thumbnailUrl,
      startDate,
      endDate,
      recurrencePattern,
      privacy,
      maxParticipants
    } = req.body;
    
    const userId = req.user.id;
    
    // Parse recurrencePattern if it's a string (from FormData)
    if (typeof recurrencePattern === 'string') {
      try {
        recurrencePattern = JSON.parse(recurrencePattern);
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recurrence pattern JSON format. Must be valid JSON.'
        });
      }
    }
    
    // Validate required fields
    if (!title || !startDate || !endDate || !recurrencePattern) {
      return res.status(400).json({
        success: false,
        message: 'Title, start date, end date, and recurrence pattern are required'
      });
    }
    
    // Validate recurrence pattern
    const patternValidation = liveSeriesService.validateRecurrencePattern(recurrencePattern);
    if (!patternValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recurrence pattern',
        errors: patternValidation.errors
      });
    }
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }
    
    if (start < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be in the past'
      });
    }
    
    // Handle thumbnail - either from file upload or URL string
    const thumbnailFile = req.files?.thumbnail?.[0] || req.files?.thumbnailUrl?.[0] || req.files?.image?.[0] || req.files?.file?.[0];
    const finalThumbnailUrl = thumbnailFile 
      ? (thumbnailFile.location || `/upload/${thumbnailFile.filename}`)
      : thumbnailUrl || null;
    
    // Validate currency
    const validCurrencies = ['NGN', 'USD'];
    const finalCurrency = currency && validCurrencies.includes(currency.toUpperCase()) 
      ? currency.toUpperCase() 
      : 'NGN';
    
    // Create series
    const series = await LiveSeries.create({
      userId,
      title,
      description,
      price: price || 0,
      currency: finalCurrency,
      category,
      thumbnailUrl: finalThumbnailUrl,
      startDate: start,
      endDate: end,
      recurrencePattern,
      privacy: privacy || 'public',
      maxParticipants: maxParticipants || 50,
      status: 'active'
    });
    
    // Generate and create sessions
    const sessions = await liveSeriesService.createSessionsForSeries(series);
    
    console.log(`[Live Series Controller] Created series ${series.id} with ${sessions.length} sessions`);
    
    return res.status(201).json({
      success: true,
      message: 'Live series created successfully',
      series: {
        ...series.dataValues,
        totalSessions: sessions.length
      }
    });
    
  } catch (error) {
    console.error('[Live Series Controller] Create series error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create live series',
      error: error.message
    });
  }
};

/**
 * Get all live series (public listing)
 * GET /api/live/series
 */
exports.getAllSeries = async (req, res) => {
  try {
    const { status, privacy, category } = req.query;
    
    const where = {};
    
    // Filter by privacy (default to public for unauthenticated users)
    if (privacy) {
      where.privacy = privacy;
    } else {
      where.privacy = 'public';
    }
    
    // Filter by status (default to active)
    if (status) {
      where.status = status;
    } else {
      where.status = 'active';
    }
    
    // Filter by category
    if (category) {
      where.category = category;
    }
    
    const series = await LiveSeries.findAll({
      where,
      order: [['startDate', 'ASC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ]
    });
    
    // Get session counts for each series
    const seriesWithStats = await Promise.all(
      series.map(async (s) => {
        const stats = await liveSeriesService.calculateSeriesStats(s.id);
        return {
          ...s.dataValues,
          stats
        };
      })
    );
    
    return res.json({
      success: true,
      count: seriesWithStats.length,
      series: seriesWithStats
    });
    
  } catch (error) {
    console.error('[Live Series Controller] Get all series error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch live series'
    });
  }
};

/**
 * Get creator's own series
 * GET /api/live/series/my-series
 */
exports.getMySeries = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    
    const where = { userId };
    
    if (status) {
      where.status = status;
    }
    
    const series = await LiveSeries.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ]
    });
    
    // Get session counts and stats for each series
    const seriesWithStats = await Promise.all(
      series.map(async (s) => {
        const stats = await liveSeriesService.calculateSeriesStats(s.id);
        return {
          ...s.dataValues,
          stats
        };
      })
    );
    
    return res.json({
      success: true,
      count: seriesWithStats.length,
      series: seriesWithStats
    });
    
  } catch (error) {
    console.error('[Live Series Controller] Get my series error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your series'
    });
  }
};

/**
 * Get series by ID
 * GET /api/live/series/:id
 */
exports.getSeriesById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const series = await LiveSeries.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ]
    });
    
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found'
      });
    }
    
    // Get statistics
    const stats = await liveSeriesService.calculateSeriesStats(series.id);
    
    // Check if user has access (optional authentication)
    let hasAccess = false;
    if (req.user) {
      hasAccess = await liveSeriesService.checkSeriesAccess(req.user.id, series.id);
    }
    
    return res.json({
      success: true,
      series: {
        ...series.dataValues,
        stats,
        hasAccess,
        requiresPayment: !hasAccess && parseFloat(series.price) > 0
      }
    });
    
  } catch (error) {
    console.error('[Live Series Controller] Get series by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch series details'
    });
  }
};

/**
 * Get all sessions for a series
 * GET /api/live/series/:id/sessions
 */
exports.getSeriesSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, upcoming, past } = req.query;
    
    // Verify series exists
    const series = await LiveSeries.findByPk(id);
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found'
      });
    }
    
    // Build filters
    const filters = {};
    if (status) filters.status = status;
    if (upcoming === 'true') filters.upcoming = true;
    if (past === 'true') filters.past = true;
    
    // Get sessions
    const sessions = await liveSeriesService.getSeriesSessions(id, filters);
    
    return res.json({
      success: true,
      count: sessions.length,
      sessions
    });
    
  } catch (error) {
    console.error('[Live Series Controller] Get series sessions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions'
    });
  }
};

/**
 * Update series
 * PUT /api/live/series/:id
 */
exports.updateSeries = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      title,
      description,
      price,
      category,
      thumbnailUrl,
      privacy,
      maxParticipants
    } = req.body;
    
    // Get series
    const series = await LiveSeries.findByPk(id);
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found'
      });
    }
    
    // Check ownership
    if (series.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can update this series'
      });
    }
    
    // Handle thumbnail
    const thumbnailFile = req.files?.thumbnail?.[0] || req.files?.thumbnailUrl?.[0];
    const finalThumbnailUrl = thumbnailFile 
      ? (thumbnailFile.location || `/upload/${thumbnailFile.filename}`)
      : thumbnailUrl || series.thumbnailUrl;
    
    // Update fields
    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (category !== undefined) updates.category = category;
    if (finalThumbnailUrl) updates.thumbnailUrl = finalThumbnailUrl;
    if (privacy) updates.privacy = privacy;
    if (maxParticipants) updates.maxParticipants = maxParticipants;
    
    await series.update(updates);
    
    return res.json({
      success: true,
      message: 'Series updated successfully',
      series
    });
    
  } catch (error) {
    console.error('[Live Series Controller] Update series error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update series'
    });
  }
};

/**
 * Cancel series
 * DELETE /api/live/series/:id
 */
exports.cancelSeries = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Get series
    const series = await LiveSeries.findByPk(id);
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found'
      });
    }
    
    // Check ownership
    if (series.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can cancel this series'
      });
    }
    
    // Check if can be cancelled
    const canCancel = liveSeriesService.canCancelSeries(series);
    if (!canCancel.canCancel) {
      return res.status(400).json({
        success: false,
        message: canCancel.reason
      });
    }
    
    // Update series status
    await series.update({ status: 'cancelled' });
    
    // Cancel all scheduled sessions
    await LiveSession.update(
      { status: 'cancelled' },
      {
        where: {
          seriesId: id,
          status: 'scheduled'
        }
      }
    );
    
    return res.json({
      success: true,
      message: 'Series cancelled successfully'
    });
    
  } catch (error) {
    console.error('[Live Series Controller] Cancel series error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel series'
    });
  }
};

module.exports = exports;
