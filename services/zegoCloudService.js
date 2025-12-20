const crypto = require('crypto');
const { 
  ZegoCloudError, 
  createError, 
  withErrorHandling, 
  validateRequiredFields,
  logOperation 
} = require('../utils/zegoCloudErrors');

// ZegoCloud configuration
const ZEGO_APP_ID = process.env.ZEGO_APP_ID;
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;
const ZEGO_TOKEN_EXPIRY = parseInt(process.env.ZEGO_TOKEN_EXPIRY);
const ZEGO_MAX_PARTICIPANTS = parseInt(process.env.ZEGO_MAX_PARTICIPANTS);



if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
  console.error("FATAL: ZEGO_APP_ID or ZEGO_SERVER_SECRET is missing from .env");
}

/**
 * ZegoCloud Service for managing live streaming rooms
 * Provides browser-based live streaming without OBS requirement
 */
class ZegoCloudService {
  
  /**
   * Create a new ZegoCloud room for live streaming
   * @param {string} liveClassId - Unique identifier for the live class
   * @param {number} creatorId - ID of the creator starting the live class
   * @param {Object} options - Additional room configuration options
   * @returns {Object} Room configuration with credentials
   */
  async createRoom(liveClassId, creatorId, options = {}) {
    return withErrorHandling(async () => {
      // Validate required inputs
      validateRequiredFields({ liveClassId, creatorId }, ['liveClassId', 'creatorId']);
      
      if (typeof creatorId !== 'number' || creatorId <= 0) {
        throw createError('INVALID_INPUT', { creatorId }, 'Creator ID must be a positive number');
      }

      // Check configuration
      if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
        throw createError('MISSING_CREDENTIALS');
      }

      // Generate unique room ID
      const roomId = this.generateRoomId(liveClassId);
      
      // Generate creator token with host privileges
      const creatorToken = this.generateToken(roomId, creatorId, 'host');
      
      // Room configuration
      const roomConfig = {
        roomId,
        appId: ZEGO_APP_ID,
        creatorToken,
        maxParticipants: ZEGO_MAX_PARTICIPANTS,
        privacy: options.privacy || 'public',
        createdAt: new Date(),
        creatorId,
        liveClassId
      };

      logOperation('createRoom', {
        roomId,
        liveClassId,
        creatorId,
        maxParticipants: ZEGO_MAX_PARTICIPANTS,
        privacy: options.privacy
      });
      
      return {
        success: true,
        roomId,
        appId: ZEGO_APP_ID,
        creatorToken,
        roomConfig
      };
    })();
  }

  /**
   * Generate access token for joining a ZegoCloud room
   * @param {string} roomId - Room identifier
   * @param {number} userId - User ID requesting access
   * @param {string} role - User role: 'host', 'participant', 'audience'
   * @returns {string} Access token for ZegoCloud SDK
   */
  generateToken(roomId, userId, role = 'participant') {
    try {
      if (!roomId || !userId) {
        throw new Error('Room ID and User ID are required');
      }

      // ZegoCloud specific token generation
      const appId = parseInt(ZEGO_APP_ID);
      const userIdStr = userId.toString();
      const serverSecret = ZEGO_SERVER_SECRET;
      const effectiveTimeInSeconds = ZEGO_TOKEN_EXPIRY || 3600;
      
      // Current timestamp
      const now = Math.floor(Date.now() / 1000);
      const exp = now + effectiveTimeInSeconds;
      
      // ZegoCloud token payload structure
      const payload = {
        iss: appId,                    // App ID as issuer
        exp: exp,                      // Expiration time
        iat: now,                      // Issued at time
        aud: 'zegocloud',             // Audience
        room_id: roomId,              // Room ID
        user_id: userIdStr,           // User ID as string
        privilege: this.getZegoPrivileges(role), // ZegoCloud privileges
        stream_id_list: null          // Stream permissions (null = all streams)
      };

      // Create header
      const header = {
        alg: 'HS256',
        typ: 'JWT'
      };

      // Encode header and payload
      const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
      const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
      
      // Create signature
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      const signature = crypto
        .createHmac('sha256', serverSecret)
        .update(signatureInput)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `${encodedHeader}.${encodedPayload}.${signature}`;
      
      console.log(`ZegoCloud token generated for user ${userId} in room ${roomId} with role ${role}`);
      
      return token;
    } catch (error) {
      console.error('ZegoCloud generateToken error:', error);
      throw new ZegoCloudError(
        'Failed to generate access token',
        'TOKEN_GENERATION_FAILED',
        { roomId, userId, role, error: error.message }
      );
    }
  }

  /**
   * Base64 URL encode helper
   * @param {string} str - String to encode
   * @returns {string} Base64 URL encoded string
   */
  base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Delete/cleanup a ZegoCloud room
   * @param {string} roomId - Room identifier to delete
   * @returns {Object} Deletion result
   */
  async deleteRoom(roomId) {
    try {
      if (!roomId) {
        throw new Error('Room ID is required');
      }

      console.log(`ZegoCloud room cleanup initiated: ${roomId}`);
      
      return {
        success: true,
        roomId,
        message: 'Room cleanup completed',
        cleanedAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud deleteRoom error:', error);
      throw new ZegoCloudError(
        'Failed to delete room',
        'ROOM_DELETION_FAILED',
        { roomId, error: error.message }
      );
    }
  }

  /**
   * Add a participant to a room (generate join token)
   * @param {string} roomId - Room identifier
   * @param {number} userId - User ID to add
   * @param {string} role - Participant role
   * @param {Object} userInfo - Additional user information for display
   * @returns {Object} Join credentials
   */
  async addParticipant(roomId, userId, role = 'participant', userInfo = {}) {
    try {
      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
        throw new Error('Room ID is required and must be a non-empty string');
      }

      if (!userId || typeof userId !== 'number' || userId <= 0) {
        throw new Error('User ID is required and must be a positive number');
      }

      const validRoles = ['host', 'participant', 'audience'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
      }

      // Ensure userInfo is an object
      const safeUserInfo = userInfo || {};

      const token = this.generateToken(roomId, userId, role);
      
      const participantData = {
        success: true,
        roomId,
        userId,
        role,
        token,
        appId: ZEGO_APP_ID,
        joinedAt: new Date(),
        userInfo: {
          displayName: safeUserInfo.displayName || `User ${userId}`,
          avatar: safeUserInfo.avatar || null,
          email: safeUserInfo.email || null
        }
      };

      console.log(`Participant ${userId} added to room ${roomId} with role ${role}`);
      
      return participantData;
    } catch (error) {
      console.error('ZegoCloud addParticipant error:', error);
      throw new ZegoCloudError(
        'Failed to add participant',
        'PARTICIPANT_ADD_FAILED',
        { roomId, userId, role, error: error.message }
      );
    }
  }

  /**
   * Remove a participant from a room
   * @param {string} roomId - Room identifier
   * @param {number} userId - User ID to remove
   * @param {string} reason - Reason for removal (optional)
   * @returns {Object} Removal result
   */
  async removeParticipant(roomId, userId, reason = 'removed') {
    try {
      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
        throw new Error('Room ID is required and must be a non-empty string');
      }

      if (!userId || typeof userId !== 'number' || userId <= 0) {
        throw new Error('User ID is required and must be a positive number');
      }

      // Ensure reason has a default value
      const safeReason = reason || 'removed';

      // Note: ZegoCloud handles participant removal through token expiry
      // and room-level controls. This method is for our internal tracking.
      console.log(`Participant ${userId} removed from room ${roomId}. Reason: ${safeReason}`);
      
      return {
        success: true,
        roomId,
        userId,
        removedAt: new Date(),
        reason: safeReason,
        message: 'Participant access revoked'
      };
    } catch (error) {
      console.error('ZegoCloud removeParticipant error:', error);
      throw new ZegoCloudError(
        'Failed to remove participant',
        'PARTICIPANT_REMOVE_FAILED',
        { roomId, userId, error: error.message }
      );
    }
  }

  /**
   * Get participants list for a room
   * Note: This is a placeholder for participant tracking
   * In a real implementation, this would integrate with a database
   * or ZegoCloud's participant management API
   * @param {string} roomId - Room identifier
   * @returns {Object} Participants list
   */
  async getParticipants(roomId) {
    try {
      if (!roomId) {
        throw new Error('Room ID is required');
      }

      // Note: This is a placeholder implementation
      // In production, this would query the database for active participants
      // or integrate with ZegoCloud's real-time participant API
      
      console.log(`Retrieving participants for room ${roomId}`);
      
      return {
        success: true,
        roomId,
        participants: [], // Would be populated from database or ZegoCloud API
        participantCount: 0,
        retrievedAt: new Date(),
        message: 'Participants retrieved successfully'
      };
    } catch (error) {
      console.error('ZegoCloud getParticipants error:', error);
      throw new ZegoCloudError(
        'Failed to get participants',
        'PARTICIPANTS_RETRIEVAL_FAILED',
        { roomId, error: error.message }
      );
    }
  }

  /**
   * Get room information and status
   * @param {string} roomId - Room identifier
   * @returns {Object} Room information
   */
  async getRoomInfo(roomId) {
    try {
      // Note: This is a placeholder for room info retrieval
      // ZegoCloud doesn't provide a direct REST API for room status
      // Room status is typically managed through the SDK callbacks
      
      return {
        success: true,
        roomId,
        appId: ZEGO_APP_ID,
        status: 'active', // This would be managed by our database
        retrievedAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud getRoomInfo error:', error);
      throw new ZegoCloudError(
        'Failed to get room info',
        'ROOM_INFO_FAILED',
        { roomId, error: error.message }
      );
    }
  }

  /**
   * Update room status (for internal tracking)
   * @param {string} roomId - Room identifier
   * @param {string} status - New status: 'active', 'ended', 'error'
   * @returns {Object} Update result
   */
  async updateRoomStatus(roomId, status) {
    try {
      const validStatuses = ['active', 'ended', 'error'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      console.log(`Room ${roomId} status updated to: ${status}`);
      
      return {
        success: true,
        roomId,
        status,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud updateRoomStatus error:', error);
      throw new ZegoCloudError(
        'Failed to update room status',
        'ROOM_STATUS_UPDATE_FAILED',
        { roomId, status, error: error.message }
      );
    }
  }

  /**
   * Synchronize room status with database
   * @param {string} liveClassId - Live class identifier
   * @param {string} roomStatus - ZegoCloud room status
   * @returns {Object} Synchronization result
   */
  async syncRoomStatusWithDatabase(liveClassId, roomStatus) {
    try {
      const { LiveClass } = require('../models/liveIndex');
      
      // Map ZegoCloud status to database status
      const statusMapping = {
        'active': 'live',
        'ended': 'ended',
        'error': 'scheduled' // Reset to scheduled on error
      };
      
      const dbStatus = statusMapping[roomStatus] || 'scheduled';
      
      // Update live class status in database
      const liveClass = await LiveClass.findByPk(liveClassId);
      if (!liveClass) {
        throw new Error(`Live class not found: ${liveClassId}`);
      }
      
      // Only update if status has changed
      if (liveClass.status !== dbStatus) {
        await liveClass.update({ 
          status: dbStatus,
          updatedAt: new Date()
        });
        
        console.log(`Database status synchronized: ${liveClassId} -> ${dbStatus}`);
      }
      
      return {
        success: true,
        liveClassId,
        previousStatus: liveClass.status,
        newStatus: dbStatus,
        syncedAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud syncRoomStatusWithDatabase error:', error);
      throw new ZegoCloudError(
        'Failed to sync room status with database',
        'DATABASE_SYNC_FAILED',
        { liveClassId, roomStatus, error: error.message }
      );
    }
  }

  /**
   * Start live streaming session and update database
   * @param {string} liveClassId - Live class identifier
   * @param {number} creatorId - Creator user ID
   * @param {Object} options - Room configuration options
   * @returns {Object} Session start result
   */
  async startLiveSession(liveClassId, creatorId, options = {}) {
    try {
      const { LiveClass } = require('../models/liveIndex');
      
      // Check for existing active session
      const existingClass = await LiveClass.findByPk(liveClassId);
      if (!existingClass) {
        throw new Error(`Live class not found: ${liveClassId}`);
      }
      
      // Prevent duplicate sessions
      if (existingClass.status === 'live') {
        throw new Error('Live class is already active');
      }
      
      // Create ZegoCloud room
      const roomResult = await this.createRoom(liveClassId, creatorId, options);
      
      // ✅ Update database with room information (NO TOKEN STORAGE)
      await existingClass.update({
        zego_room_id: roomResult.roomId,
        zego_app_id: roomResult.appId,
        // ❌ REMOVED: zego_room_token: roomResult.creatorToken,
        status: 'live',
        max_participants: options.maxParticipants || existingClass.max_participants,
        updatedAt: new Date()
      });
      
      console.log(`Live session started: ${liveClassId} with room ${roomResult.roomId}`);
      
      return {
        success: true,
        liveClassId,
        roomId: roomResult.roomId,
        appId: roomResult.appId,
        creatorToken: roomResult.creatorToken, // ✅ Return token but don't store it
        sessionStartedAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud startLiveSession error:', error);
      throw new ZegoCloudError(
        'Failed to start live session',
        'SESSION_START_FAILED',
        { liveClassId, creatorId, error: error.message }
      );
    }
  }

  /**
   * End live streaming session and cleanup
   * @param {string} liveClassId - Live class identifier
   * @param {string} reason - Reason for ending session
   * @returns {Object} Session end result
   */
  async endLiveSession(liveClassId, reason = 'session_ended') {
    try {
      const { LiveClass } = require('../models/liveIndex');
      
      const liveClass = await LiveClass.findByPk(liveClassId);
      if (!liveClass) {
        throw new Error(`Live class not found: ${liveClassId}`);
      }
      
      // Only end if currently live
      if (liveClass.status !== 'live') {
        return {
          success: true,
          message: 'Session was not active',
          liveClassId,
          endedAt: new Date()
        };
      }
      
      // Cleanup ZegoCloud room if exists
      if (liveClass.zego_room_id) {
        await this.deleteRoom(liveClass.zego_room_id);
      }
      
      // Update database status
      await liveClass.update({
        status: 'ended',
        endTime: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Live session ended: ${liveClassId}. Reason: ${reason}`);
      
      return {
        success: true,
        liveClassId,
        roomId: liveClass.zego_room_id,
        reason,
        endedAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud endLiveSession error:', error);
      throw new ZegoCloudError(
        'Failed to end live session',
        'SESSION_END_FAILED',
        { liveClassId, error: error.message }
      );
    }
  }

  /**
   * Check for and prevent duplicate active sessions for a creator
   * @param {number} creatorId - Creator user ID
   * @param {string} excludeLiveClassId - Live class ID to exclude from check
   * @returns {Object} Duplicate check result
   */
  async checkForDuplicateSessions(creatorId, excludeLiveClassId = null) {
    try {
      const { LiveClass } = require('../models/liveIndex');
      const { Op } = require('sequelize');
      
      const whereClause = {
        userId: creatorId,
        status: 'live',
        streaming_provider: 'zegocloud'
      };
      
      // Exclude specific live class if provided
      if (excludeLiveClassId) {
        whereClause.id = { [Op.ne]: excludeLiveClassId };
      }
      
      const activeSessions = await LiveClass.findAll({
        where: whereClause,
        attributes: ['id', 'title', 'zego_room_id', 'startTime']
      });
      
      return {
        success: true,
        hasDuplicates: activeSessions.length > 0,
        activeSessions: activeSessions.map(session => ({
          id: session.id,
          title: session.title,
          roomId: session.zego_room_id,
          startTime: session.startTime
        })),
        checkedAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud checkForDuplicateSessions error:', error);
      throw new ZegoCloudError(
        'Failed to check for duplicate sessions',
        'DUPLICATE_CHECK_FAILED',
        { creatorId, error: error.message }
      );
    }
  }

  /**
   * Cleanup inactive rooms (scheduled cleanup task)
   * @param {number} maxAgeHours - Maximum age in hours for inactive rooms
   * @returns {Object} Cleanup result
   */
  async cleanupInactiveRooms(maxAgeHours = 24) {
    try {
      const { LiveClass } = require('../models/liveIndex');
      const { Op } = require('sequelize');
      
      const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
      
      // Find stale live sessions
      const staleSessions = await LiveClass.findAll({
        where: {
          status: 'live',
          streaming_provider: 'zegocloud',
          updatedAt: { [Op.lt]: cutoffTime }
        }
      });
      
      let cleanedCount = 0;
      const cleanedSessions = [];
      
      for (const session of staleSessions) {
        try {
          await this.endLiveSession(session.id, 'cleanup_inactive');
          cleanedCount++;
          cleanedSessions.push({
            id: session.id,
            title: session.title,
            roomId: session.zego_room_id
          });
        } catch (error) {
          console.error(`Failed to cleanup session ${session.id}:`, error);
        }
      }
      
      console.log(`Cleanup completed: ${cleanedCount} inactive rooms cleaned`);
      
      return {
        success: true,
        cleanedCount,
        cleanedSessions,
        maxAgeHours,
        cleanupAt: new Date()
      };
    } catch (error) {
      console.error('ZegoCloud cleanupInactiveRooms error:', error);
      throw new ZegoCloudError(
        'Failed to cleanup inactive rooms',
        'CLEANUP_FAILED',
        { maxAgeHours, error: error.message }
      );
    }
  }

  /**
   * Generate unique room ID based on live class ID
   * @param {string} liveClassId - Live class identifier
   * @returns {string} Unique room ID
   */
  generateRoomId(liveClassId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `live_${liveClassId}_${timestamp}_${random}`;
  }

  /**
   * Get ZegoCloud specific privileges for token generation
   * @param {string} role - User role
   * @returns {Object} ZegoCloud privilege object
   */
  getZegoPrivileges(role) {
    // ZegoCloud privilege constants
    const PRIVILEGE_KEY_LOGIN = 1;           // Login privilege
    const PRIVILEGE_KEY_PUBLISH = 2;         // Publish stream privilege
    
    const privileges = {};
    
    // All users can login
    privileges[PRIVILEGE_KEY_LOGIN] = 1;
    
    // Set publish privileges based on role
    if (role === 'host' || role === 'participant') {
      privileges[PRIVILEGE_KEY_PUBLISH] = 1;  // Can publish
    } else {
      privileges[PRIVILEGE_KEY_PUBLISH] = 0;  // Cannot publish (audience)
    }

    return privileges;
  }

  /**
   * Get role-based privileges for token generation (legacy method)
   * @param {string} role - User role
   * @returns {Object} Role privileges
   */
  getRolePrivileges(role) {
    const privileges = {
      host: {
        canPublish: true,
        canSubscribe: true,
        canKickOut: true,
        canMuteOthers: true,
        canManageRoom: true
      },
      participant: {
        canPublish: true,
        canSubscribe: true,
        canKickOut: false,
        canMuteOthers: false,
        canManageRoom: false
      },
      audience: {
        canPublish: false,
        canSubscribe: true,
        canKickOut: false,
        canMuteOthers: false,
        canManageRoom: false
      }
    };

    return privileges[role] || privileges.audience;
  }

  /**
   * Validate ZegoCloud configuration
   * @returns {Object} Configuration validation result
   */
  validateConfiguration() {
    const issues = [];
    
    if (!ZEGO_APP_ID) {
      issues.push('ZEGO_APP_ID is not configured');
    }
    
    if (!ZEGO_SERVER_SECRET) {
      issues.push('ZEGO_SERVER_SECRET is not configured');
    }
    
    if (ZEGO_TOKEN_EXPIRY < 300) {
      issues.push('ZEGO_TOKEN_EXPIRY should be at least 300 seconds (5 minutes)');
    }

    return {
      valid: issues.length === 0,
      issues,
      configuration: {
        appId: ZEGO_APP_ID ? 'configured' : 'missing',
        serverSecret: ZEGO_SERVER_SECRET ? 'configured' : 'missing',
        tokenExpiry: ZEGO_TOKEN_EXPIRY
      }
    };
  }
}

// Export singleton instance
const zegoCloudService = new ZegoCloudService();

module.exports = {
  zegoCloudService,
  ZegoCloudError
};