const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Purchase = sequelize.define('Purchase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  contentType: {
    type: DataTypes.ENUM('video', 'live_class'),
    allowNull: false,
    field: 'content_type'
  },
  contentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'content_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'NGN'
  },
  paymentGateway: {
    type: DataTypes.ENUM('paystack', 'stripe'),
    allowNull: false,
    field: 'payment_gateway'
  },
  paymentReference: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
    field: 'payment_reference'
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending',
    field: 'payment_status'
  }
}, {
  tableName: 'purchases',
  timestamps: true,
  underscored: true
});

module.exports = Purchase;
