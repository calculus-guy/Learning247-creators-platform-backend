const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const LiveClass = sequelize.define('LiveClass', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: { type: DataTypes.INTEGER, allowNull: false }, // Creator of the live class
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  price: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 },
  thumbnailUrl: { type: DataTypes.STRING, allowNull: true },
  startTime: { type: DataTypes.DATE, allowNull: true },
  endTime: { type: DataTypes.DATE, allowNull: true },

  privacy: { type: DataTypes.ENUM('public', 'private'), defaultValue: 'public' },
  status: { type: DataTypes.ENUM('scheduled','live','ended','recorded'), defaultValue: 'scheduled' },

  // Mux live fields
  mux_stream_id: { type: DataTypes.STRING, allowNull: true },
  mux_stream_key: { type: DataTypes.STRING, allowNull: true },
  mux_rtmp_url: { type: DataTypes.STRING, allowNull: true },
  mux_playback_id: { type: DataTypes.STRING, allowNull: true },
  recording_asset_id: { type: DataTypes.STRING, allowNull: true },

}, {
  tableName: 'live_classes',
  timestamps: true,
  underscored: true
});

module.exports = LiveClass;