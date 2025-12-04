const User = require('./User');
const Purchase = require('./Purchase');
const Wallet = require('./Wallet');
const Payout = require('./Payout');
const Transaction = require('./Transaction');
const Video = require('./Video');
const LiveClass = require('./liveClass');

// User associations
User.hasMany(Purchase, { foreignKey: 'userId', as: 'purchases' });
User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
User.hasMany(Payout, { foreignKey: 'userId', as: 'payouts' });
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });

// Purchase associations
Purchase.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Wallet associations
Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Payout associations
Payout.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Transaction associations
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Video associations (for purchases)
Video.hasMany(Purchase, { 
  foreignKey: 'contentId',
  constraints: false,
  scope: {
    contentType: 'video'
  },
  as: 'purchases'
});

// LiveClass associations (for purchases)
LiveClass.hasMany(Purchase, { 
  foreignKey: 'contentId',
  constraints: false,
  scope: {
    contentType: 'live_class'
  },
  as: 'purchases'
});

module.exports = {
  User,
  Purchase,
  Wallet,
  Payout,
  Transaction,
  Video,
  LiveClass
};
