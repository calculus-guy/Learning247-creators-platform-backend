const QuizProfile = require('../models/QuizProfile');
const QuizChallenge = require('../models/QuizChallenge');
const QuizMatch = require('../models/QuizMatch');
const User = require('../models/User');
const { Op } = require('sequelize');

// Create or update quiz profile
exports.createProfile = async (req, res) => {
  try {
    const { nickname, avatar_ref } = req.body;
    const userId = req.user.id;

    // Check if profile exists
    let profile = await QuizProfile.findOne({ where: { user_id: userId } });

    if (profile) {
      // Update existing profile
      await profile.update({
        nickname: nickname || profile.nickname,
        avatar_ref: avatar_ref || profile.avatar_ref
      });
    } else {
      // Create new profile
      profile = await QuizProfile.create({
        user_id: userId,
        nickname: nickname || `Player${userId}`,
        avatar_ref: avatar_ref || 'lib:avatar_1'
      });
    }

    return res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Create profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create/update profile'
    });
  }
};

// Get lobby (online players)
exports.getLobby = async (req, res) => {
  try {
    // For now, just return all profiles (in real implementation, this would check WebSocket connections)
    const profiles = await QuizProfile.findAll({
      include: [{
        model: User,
        attributes: ['id', 'firstname', 'lastname']
      }],
      limit: 50,
      order: [['zeta_balance', 'DESC']]
    });

    return res.json({
      success: true,
      lobby: {
        online_count: profiles.length,
        players: profiles.map(p => ({
          user_id: p.user_id,
          nickname: p.nickname,
          avatar_ref: p.avatar_ref,
          wins: p.wins,
          losses: p.losses,
          zeta_balance: p.zeta_balance,
          idle_seconds: 0 // Would be calculated from WebSocket data
        }))
      }
    });
  } catch (error) {
    console.error('Get lobby error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get lobby'
    });
  }
};

// Create challenge
exports.createChallenge = async (req, res) => {
  try {
    const { target_user_id, categories, wager, wager_enabled } = req.body;
    const challengerId = req.user.id;

    // Basic validation
    if (!target_user_id || !categories || !Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if challenger has enough Zeta
    if (wager_enabled && wager > 0) {
      const challengerProfile = await QuizProfile.findOne({ where: { user_id: challengerId } });
      if (!challengerProfile || challengerProfile.zeta_balance < wager) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient Zeta balance'
        });
      }
    }

    // Create challenge
    const expiresAt = new Date(Date.now() + 60000); // 60 seconds
    const challenge = await QuizChallenge.create({
      challenger_id: challengerId,
      target_id: target_user_id,
      categories,
      wager: wager || 0,
      wager_enabled: wager_enabled || false,
      expires_at: expiresAt
    });

    return res.json({
      success: true,
      challenge
    });
  } catch (error) {
    console.error('Create challenge error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create challenge'
    });
  }
};

// Cancel challenge
exports.cancelChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const challenge = await QuizChallenge.findOne({
      where: {
        id,
        challenger_id: userId,
        status: 'pending'
      }
    });

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found or cannot be cancelled'
      });
    }

    await challenge.update({ status: 'cancelled' });

    return res.json({
      success: true,
      message: 'Challenge cancelled'
    });
  } catch (error) {
    console.error('Cancel challenge error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel challenge'
    });
  }
};

// Respond to challenge
exports.respondToChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const { accept } = req.body;
    const userId = req.user.id;

    const challenge = await QuizChallenge.findOne({
      where: {
        id,
        target_id: userId,
        status: 'pending'
      }
    });

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }

    // Check if expired
    if (new Date() > challenge.expires_at) {
      await challenge.update({ status: 'timed_out' });
      return res.status(400).json({
        success: false,
        message: 'Challenge has expired'
      });
    }

    if (accept) {
      // Accept challenge - create match
      await challenge.update({ status: 'accepted' });

      // Create match (simplified - in real implementation, this would start the game engine)
      const match = await QuizMatch.create({
        player_a_id: challenge.challenger_id,
        player_b_id: challenge.target_id,
        wager: challenge.wager,
        status: 'in_progress'
      });

      return res.json({
        success: true,
        message: 'Challenge accepted',
        match_id: match.id
      });
    } else {
      // Reject challenge
      await challenge.update({ status: 'rejected' });
      return res.json({
        success: true,
        message: 'Challenge rejected'
      });
    }
  } catch (error) {
    console.error('Respond to challenge error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to respond to challenge'
    });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const profiles = await QuizProfile.findAll({
      include: [{
        model: User,
        attributes: ['id', 'firstname', 'lastname']
      }],
      order: [
        ['zeta_balance', 'DESC'],
        ['wins', 'DESC']
      ],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const leaderboard = profiles.map((profile, index) => ({
      rank: parseInt(offset) + index + 1,
      user_id: profile.user_id,
      nickname: profile.nickname,
      avatar_ref: profile.avatar_ref,
      zeta_balance: profile.zeta_balance,
      wins: profile.wins,
      losses: profile.losses,
      win_rate: profile.wins + profile.losses > 0 
        ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100 * 10) / 10 
        : 0
    }));

    return res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard'
    });
  }
};

// Get match history
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const matches = await QuizMatch.findAll({
      where: {
        [Op.or]: [
          { player_a_id: userId },
          { player_b_id: userId }
        ]
      },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const history = matches.map(match => ({
      id: match.id,
      opponent_id: match.player_a_id === userId ? match.player_b_id : match.player_a_id,
      your_score: match.player_a_id === userId ? match.player_a_score : match.player_b_score,
      opponent_score: match.player_a_id === userId ? match.player_b_score : match.player_a_score,
      won: match.winner_id === userId,
      wager: match.wager,
      created_at: match.created_at
    }));

    return res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get match history'
    });
  }
};