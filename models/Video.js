const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Video = sequelize.define('Video', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  price: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  type: { type: DataTypes.ENUM('short','long'), defaultValue: 'short' },
  category: { type: DataTypes.STRING, allowNull: true },
  tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
  privacy: { type: DataTypes.ENUM('public','unlisted','private'), defaultValue: 'public' },
  ageRestriction: { type: DataTypes.BOOLEAN, defaultValue: false },
  thumbnailUrl: { type: DataTypes.TEXT, allowNull: true },
  muxUploadId: { type: DataTypes.STRING, allowNull: true },
  muxAssetId: { type: DataTypes.STRING, allowNull: true },
  muxPlaybackId: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('uploading','processing','ready','failed'), defaultValue: 'uploading' },
  durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
  sizeBytes: { type: DataTypes.BIGINT, allowNull: true },
  viewsCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'videos',
  timestamps: true,
  underscored: true
});

module.exports = Video;