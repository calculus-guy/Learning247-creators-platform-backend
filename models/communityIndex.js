'use strict';
const Community = require('./Community');
const CommunityMember = require('./CommunityMember');
const CommunityAnnouncement = require('./CommunityAnnouncement');
const CommunityContentSubmission = require('./CommunityContentSubmission');
const User = require('./User');
const LiveClass = require('./liveClass');
const LiveSeries = require('./LiveSeries');
const Video = require('./Video');
const Freebie = require('./Freebie');

// Community core associations
Community.hasMany(CommunityMember, { foreignKey: 'communityId', as: 'members', onDelete: 'CASCADE' });
CommunityMember.belongsTo(Community, { foreignKey: 'communityId', as: 'community' });

Community.hasMany(CommunityAnnouncement, { foreignKey: 'communityId', as: 'announcements', onDelete: 'CASCADE' });
CommunityAnnouncement.belongsTo(Community, { foreignKey: 'communityId', as: 'community' });

Community.hasMany(CommunityContentSubmission, { foreignKey: 'communityId', as: 'submissions', onDelete: 'CASCADE' });
CommunityContentSubmission.belongsTo(Community, { foreignKey: 'communityId', as: 'community' });

// User associations
Community.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
CommunityMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
CommunityAnnouncement.belongsTo(User, { foreignKey: 'createdBy', as: 'author' });
CommunityContentSubmission.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });

// Content table associations
LiveClass.belongsTo(Community, { foreignKey: 'communityId', as: 'community' });
Community.hasMany(LiveClass, { foreignKey: 'communityId', as: 'liveClasses' });

LiveSeries.belongsTo(Community, { foreignKey: 'communityId', as: 'community' });
Community.hasMany(LiveSeries, { foreignKey: 'communityId', as: 'liveSeries' });

Video.belongsTo(Community, { foreignKey: 'communityId', as: 'community' });
Community.hasMany(Video, { foreignKey: 'communityId', as: 'videos' });

Freebie.belongsTo(Community, { foreignKey: 'communityId', as: 'community' });
Community.hasMany(Freebie, { foreignKey: 'communityId', as: 'freebies' });

module.exports = {
  Community,
  CommunityMember,
  CommunityAnnouncement,
  CommunityContentSubmission
};
