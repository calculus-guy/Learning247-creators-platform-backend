const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  firstname: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastname: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Password is not required for OAuth
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'viewer',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  hooks: {
    afterCreate: async (user, options) => {
      try {
        console.log(`[User Hook] Creating wallets for new user ${user.id} (${user.email})`);
        
        // Import wallet service
        const { getOrCreateWallet } = require('../services/walletService');
        
        // Create NGN and USD wallets for the new user
        await getOrCreateWallet(user.id, 'NGN');
        await getOrCreateWallet(user.id, 'USD');
        
        console.log(`[User Hook] ✅ Wallets created successfully for user ${user.id}`);
      } catch (error) {
        console.error(`[User Hook] ❌ Failed to create wallets for user ${user.id}:`, error.message);
        // Don't throw error - user creation should succeed even if wallet creation fails
        // Wallets can be created later via the initialize endpoint
      }
    }
  }
});

module.exports = User;