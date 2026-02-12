const sequelize = require('./config/db');
const User = require('./models/User');
const { getOrCreateWallet } = require('./services/walletService');

async function createMissingWallets() {
  try {
    console.log('🚀 Starting wallet creation for existing users...\n');
    
    // Step 1: Get all users
    console.log('1️⃣ Fetching all users...');
    const users = await User.findAll({
      attributes: ['id', 'email', 'firstname', 'lastname'],
      order: [['id', 'ASC']]
    });
    
    console.log(`   Found ${users.length} users\n`);

    // Step 2: Check and create wallets for each user
    console.log('2️⃣ Creating wallets for users...\n');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const user of users) {
      try {
        console.log(`   Processing user ${user.id} (${user.email})...`);
        
        // Create NGN wallet
        await getOrCreateWallet(user.id, 'NGN');
        console.log(`      ✅ NGN wallet created/verified`);
        
        // Create USD wallet
        await getOrCreateWallet(user.id, 'USD');
        console.log(`      ✅ USD wallet created/verified`);
        
        successCount++;
      } catch (error) {
        console.error(`      ❌ Failed for user ${user.id}:`, error.message);
        errorCount++;
        errors.push({
          userId: user.id,
          email: user.email,
          error: error.message
        });
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors:');
      errors.forEach(err => {
        console.log(`   - User ${err.userId} (${err.email}): ${err.error}`);
      });
    }

    console.log('\n🎉 Wallet creation completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. All new users will automatically get wallets on signup');
    console.log('   2. Existing users now have wallets');
    console.log('   3. Payment routing will auto-create wallets if missing');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating wallets:', error.message);
    console.error('\nFull error:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL connection is working');
    console.log('   2. Check if Users table exists');
    console.log('   3. Check if wallet_accounts table exists');
    console.log('   4. Verify database connection in .env file');
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Script interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Script terminated');
  process.exit(1);
});

createMissingWallets();
