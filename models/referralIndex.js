/**
 * Referral Models Index
 * 
 * Sets up associations between Referral models
 */

const ReferralCode = require('./ReferralCode');
const ReferralCommission = require('./ReferralCommission');
const User = require('./User');
const Purchase = require('./Purchase');

// ReferralCode associations
ReferralCode.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

ReferralCode.hasMany(ReferralCommission, {
  foreignKey: 'referralCode',
  sourceKey: 'referralCode',
  as: 'commissions'
});

// ReferralCommission associations
ReferralCommission.belongsTo(User, {
  foreignKey: 'referrerUserId',
  as: 'referrer'
});

ReferralCommission.belongsTo(User, {
  foreignKey: 'refereeUserId',
  as: 'referee'
});

ReferralCommission.belongsTo(User, {
  foreignKey: 'approvedBy',
  as: 'approver'
});

ReferralCommission.belongsTo(Purchase, {
  foreignKey: 'purchaseId',
  as: 'purchase'
});

// User associations
User.hasMany(ReferralCode, {
  foreignKey: 'userId',
  as: 'referralCodes'
});

User.hasMany(ReferralCommission, {
  foreignKey: 'referrerUserId',
  as: 'referralsMade'
});

User.hasMany(ReferralCommission, {
  foreignKey: 'refereeUserId',
  as: 'referralsReceived'
});

module.exports = {
  ReferralCode,
  ReferralCommission
};
