const sequelize = require('./config/db');
const LiveClassCleanupService = require('./services/liveClassCleanupService');

// Load models to ensure they're registered
require('./models/liveIndex');

async function cleanupLiveClasses() {
  try {
    console.log('🚀 Starting Live Classes Cleanup...\n');
    
    const cleanupService = new LiveClassCleanupService();
    
    // Step 1: Show current stats
    console.log('📊 Current Status:');
    const statsBefore = await cleanupService.getCleanupStats();
    console.log('   Status breakdown:', statsBefore.statusCounts);
    console.log(`   Total classes: ${statsBefore.totalClasses}\n`);
    
    // Step 2: Run one-time cleanup
    console.log('🧹 Running one-time cleanup...');
    const cleanupResult = await cleanupService.oneTimeCleanup();
    console.log(`✅ Cleanup completed: ${cleanupResult.endedCount} classes ended\n`);
    
    // Step 3: Show updated stats
    console.log('📊 After Cleanup:');
    const statsAfter = await cleanupService.getCleanupStats();
    console.log('   Status breakdown:', statsAfter.statusCounts);
    console.log(`   Total classes: ${statsAfter.totalClasses}\n`);
    
    // Step 4: Summary
    console.log('🎉 Cleanup Summary:');
    console.log(`   - Classes processed: ${cleanupResult.totalLiveClasses}`);
    console.log(`   - Classes ended: ${cleanupResult.endedCount}`);
    console.log(`   - Classes still live: ${statsAfter.statusCounts.live || 0}`);
    console.log(`   - Classes ended: ${statsAfter.statusCounts.ended || 0}`);
    console.log(`   - Classes scheduled: ${statsAfter.statusCounts.scheduled || 0}\n`);
    
    console.log('✅ Live classes cleanup completed successfully!');
    console.log('💡 Recommendation: Set up cron jobs for ongoing maintenance');
    console.log('   - Add to server.js or use PM2 cron');
    console.log('   - Run auto-cleanup every hour');
    console.log('   - Run archival weekly\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error('\nFull error:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check database connection');
    console.log('   2. Verify live_classes table exists');
    console.log('   3. Check model associations');
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Cleanup interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Cleanup terminated');
  process.exit(1);
});

cleanupLiveClasses();