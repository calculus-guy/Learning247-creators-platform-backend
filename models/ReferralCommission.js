const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * ReferralCommission Model
 * 
 * Tracks commissions earned from referrals
 * Requires admin approval before payment
 */

const ReferralCommission = sequelize.define('ReferralCommission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  referralCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'referral_code'
  },
  referrerUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'referrer_user_id',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  refereeUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'referee_user_id',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  purchaseId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'purchase_id',
    references: {
      model: 'purchases',
      key: 'id'
    }
  },
  seriesId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'series_id'
  },
  couponCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'coupon_code'
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'commission_amount'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'paid'),
    defaultValue: 'pending',
    allowNull: false
  },
  purchasedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'purchased_at'
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'approved_by',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paid_at'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'referral_commissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * Associations
 */
ReferralCommission.associate = (models) => {
  ReferralCommission.belongsTo(models.User, {
    foreignKey: 'referrerUserId',
    as: 'referrer'
  });

  ReferralCommission.belongsTo(models.User, {
    foreignKey: 'refereeUserId',
    as: 'referee'
  });

  ReferralCommission.belongsTo(models.User, {
    foreignKey: 'approvedBy',
    as: 'approver'
  });

  ReferralCommission.belongsTo(models.Purchase, {
    foreignKey: 'purchaseId',
    as: 'purchase'
  });
};

module.exports = ReferralCommission;
