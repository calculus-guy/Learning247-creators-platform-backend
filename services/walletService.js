const Wallet = require('../models/Wallet');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');
const { Op } = require('sequelize');

/**
 * Get or create wallet for a user
 */
async function getOrCreateWallet(userId) {
  try {
    let wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        totalEarnings: 0,
        withdrawnAmount: 0,
        pendingAmount: 0,
        currency: 'NGN'
      });
    }

    return wallet;
  } catch (error) {
    console.error('Get or create wallet error:', error);
    throw error;
  }
}

/**
 * Add earnings to wallet
 */
async function addEarnings({ userId, amount, purchaseId }) {
  try {
    const wallet = await getOrCreateWallet(userId);

    wallet.totalEarnings = parseFloat(wallet.totalEarnings) + parseFloat(amount);
    await wallet.save();

    return wallet;
  } catch (error) {
    console.error('Add earnings error:', error);
    throw error;
  }
}

/**
 * Get available balance for a user
 */
async function getAvailableBalance(userId) {
  try {
    const wallet = await getOrCreateWallet(userId);
    
    const availableBalance = parseFloat(wallet.totalEarnings) - 
                            parseFloat(wallet.withdrawnAmount) - 
                            parseFloat(wallet.pendingAmount);

    return {
      totalEarnings: parseFloat(wallet.totalEarnings),
      withdrawnAmount: parseFloat(wallet.withdrawnAmount),
      pendingAmount: parseFloat(wallet.pendingAmount),
      availableBalance: availableBalance,
      currency: wallet.currency
    };
  } catch (error) {
    console.error('Get available balance error:', error);
    throw error;
  }
}

/**
 * Get earnings breakdown for a creator
 */
async function getEarningsBreakdown(userId) {
  try {
    const wallet = await getOrCreateWallet(userId);

    // Get all purchases for creator's content
    const videoPurchases = await Purchase.findAll({
      where: {
        contentType: 'video',
        paymentStatus: 'completed'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ]
    });

    const liveClassPurchases = await Purchase.findAll({
      where: {
        contentType: 'live_class',
        paymentStatus: 'completed'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ]
    });

    // Filter purchases for creator's content
    const creatorVideoPurchases = [];
    for (const purchase of videoPurchases) {
      const video = await Video.findByPk(purchase.contentId);
      if (video && video.userId === userId) {
        creatorVideoPurchases.push({
          ...purchase.toJSON(),
          contentTitle: video.title,
          contentType: 'video'
        });
      }
    }

    const creatorLiveClassPurchases = [];
    for (const purchase of liveClassPurchases) {
      const liveClass = await LiveClass.findByPk(purchase.contentId);
      if (liveClass && liveClass.userId === userId) {
        creatorLiveClassPurchases.push({
          ...purchase.toJSON(),
          contentTitle: liveClass.title,
          contentType: 'live_class'
        });
      }
    }

    const allPurchases = [...creatorVideoPurchases, ...creatorLiveClassPurchases];

    // Calculate totals
    const totalFromVideos = creatorVideoPurchases.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalFromLiveClasses = creatorLiveClassPurchases.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    return {
      wallet: {
        totalEarnings: parseFloat(wallet.totalEarnings),
        withdrawnAmount: parseFloat(wallet.withdrawnAmount),
        pendingAmount: parseFloat(wallet.pendingAmount),
        availableBalance: wallet.getAvailableBalance(),
        currency: wallet.currency
      },
      breakdown: {
        totalFromVideos,
        totalFromLiveClasses,
        totalSales: allPurchases.length,
        videoSales: creatorVideoPurchases.length,
        liveClassSales: creatorLiveClassPurchases.length
      },
      recentSales: allPurchases.slice(0, 10) // Last 10 sales
    };
  } catch (error) {
    console.error('Get earnings breakdown error:', error);
    throw error;
  }
}

/**
 * Get list of students who purchased creator's content
 */
async function getCreatorPurchases(userId, { limit = 50, offset = 0, contentType = null } = {}) {
  try {
    // Get all creator's videos
    const videos = await Video.findAll({
      where: { userId },
      attributes: ['id', 'title', 'price', 'type']
    });

    // Get all creator's live classes
    const liveClasses = await LiveClass.findAll({
      where: { userId },
      attributes: ['id', 'title', 'price', 'startTime']
    });

    const videoIds = videos.map(v => v.id);
    const liveClassIds = liveClasses.map(lc => lc.id);

    // Build query filters
    const whereClause = {
      paymentStatus: 'completed',
      [Op.or]: [
        {
          contentType: 'video',
          contentId: { [Op.in]: videoIds }
        },
        {
          contentType: 'live_class',
          contentId: { [Op.in]: liveClassIds }
        }
      ]
    };

    // Filter by content type if specified
    if (contentType && ['video', 'live_class'].includes(contentType)) {
      if (contentType === 'video') {
        whereClause[Op.or] = [{ contentType: 'video', contentId: { [Op.in]: videoIds } }];
      } else {
        whereClause[Op.or] = [{ contentType: 'live_class', contentId: { [Op.in]: liveClassIds } }];
      }
    }

    // Get purchases
    const purchases = await Purchase.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    // Enrich with content details
    const enrichedPurchases = await Promise.all(
      purchases.rows.map(async (purchase) => {
        const purchaseData = purchase.toJSON();
        
        if (purchase.contentType === 'video') {
          const video = videos.find(v => v.id === purchase.contentId);
          purchaseData.content = video ? video.toJSON() : null;
        } else if (purchase.contentType === 'live_class') {
          const liveClass = liveClasses.find(lc => lc.id === purchase.contentId);
          purchaseData.content = liveClass ? liveClass.toJSON() : null;
        }
        
        return purchaseData;
      })
    );

    return {
      total: purchases.count,
      purchases: enrichedPurchases,
      limit,
      offset
    };
  } catch (error) {
    console.error('Get creator purchases error:', error);
    throw error;
  }
}

/**
 * Lock amount in wallet for pending withdrawal
 */
async function lockAmountForWithdrawal(userId, amount) {
  try {
    const wallet = await getOrCreateWallet(userId);

    const availableBalance = wallet.getAvailableBalance();
    
    if (availableBalance < amount) {
      throw new Error('Insufficient balance');
    }

    wallet.pendingAmount = parseFloat(wallet.pendingAmount) + parseFloat(amount);
    await wallet.save();

    return wallet;
  } catch (error) {
    console.error('Lock amount error:', error);
    throw error;
  }
}

/**
 * Release locked amount (if withdrawal fails)
 */
async function releaseLockedAmount(userId, amount) {
  try {
    const wallet = await getOrCreateWallet(userId);

    wallet.pendingAmount = parseFloat(wallet.pendingAmount) - parseFloat(amount);
    await wallet.save();

    return wallet;
  } catch (error) {
    console.error('Release locked amount error:', error);
    throw error;
  }
}

/**
 * Complete withdrawal (move from pending to withdrawn)
 */
async function completeWithdrawal(userId, amount) {
  try {
    const wallet = await getOrCreateWallet(userId);

    wallet.withdrawnAmount = parseFloat(wallet.withdrawnAmount) + parseFloat(amount);
    wallet.pendingAmount = parseFloat(wallet.pendingAmount) - parseFloat(amount);
    await wallet.save();

    return wallet;
  } catch (error) {
    console.error('Complete withdrawal error:', error); 
    throw error;
  }
}

module.exports = {
  getOrCreateWallet,
  addEarnings,
  getAvailableBalance,
  getEarningsBreakdown,
  getCreatorPurchases,
  lockAmountForWithdrawal,
  releaseLockedAmount,
  completeWithdrawal
};
