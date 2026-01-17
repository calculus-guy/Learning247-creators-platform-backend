require('dotenv').config();

console.log('🔍 Database Configuration Checker\n');

console.log('Environment Variables:');
console.log('=====================');

// Check for DATABASE_URL
if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL: SET');
  // Don't log the full URL for security, just show it exists
  const url = process.env.DATABASE_URL;
  const maskedUrl = url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  console.log(`   Format: ${maskedUrl}`);
} else {
  console.log('❌ DATABASE_URL: NOT SET');
}

console.log('');

// Check individual database variables
const dbVars = [
  { name: 'DB_NAME', alt: 'POSTGRES_DB', value: process.env.DB_NAME || process.env.POSTGRES_DB },
  { name: 'DB_USER', alt: 'POSTGRES_USER', value: process.env.DB_USER || process.env.POSTGRES_USER },
  { name: 'DB_PASSWORD', alt: 'POSTGRES_PASSWORD', value: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD },
  { name: 'DB_HOST', alt: 'POSTGRES_HOST', value: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost' },
  { name: 'DB_PORT', alt: 'POSTGRES_PORT', value: process.env.DB_PORT || process.env.POSTGRES_PORT || '5432' }
];

console.log('Individual Database Variables:');
console.log('=============================');

dbVars.forEach(dbVar => {
  const status = dbVar.value ? '✅' : '❌';
  const displayValue = dbVar.name.includes('PASSWORD') && dbVar.value ? '***' : (dbVar.value || 'NOT SET');
  console.log(`${status} ${dbVar.name} or ${dbVar.alt}: ${displayValue}`);
});

console.log('');

// Check .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file found');
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    console.log(`   Contains ${lines.length} environment variables`);
    
    // Check for database-related variables in .env
    const dbLines = lines.filter(line => 
      line.includes('DATABASE_URL') || 
      line.includes('DB_') || 
      line.includes('POSTGRES_')
    );
    
    if (dbLines.length > 0) {
      console.log('   Database-related variables found:');
      dbLines.forEach(line => {
        const [key] = line.split('=');
        console.log(`     - ${key}`);
      });
    } else {
      console.log('   ⚠️  No database-related variables found in .env');
    }
  } catch (error) {
    console.log('   ❌ Error reading .env file:', error.message);
  }
} else {
  console.log('❌ .env file not found');
}

console.log('');

// Provide recommendations
console.log('Recommendations:');
console.log('===============');

if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL is set - you should be able to run the migration');
} else if (process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD) {
  console.log('✅ Individual DB variables are set - you should be able to run the migration');
} else {
  console.log('❌ Database configuration is incomplete');
  console.log('');
  console.log('To fix this, you need to set either:');
  console.log('');
  console.log('Option 1 - Add DATABASE_URL to your .env file:');
  console.log('DATABASE_URL=postgresql://username:password@host:port/database');
  console.log('');
  console.log('Option 2 - Add individual variables to your .env file:');
  console.log('DB_NAME=your_database_name');
  console.log('DB_USER=your_username');
  console.log('DB_PASSWORD=your_password');
  console.log('DB_HOST=your_host');
  console.log('DB_PORT=5432');
}

console.log('');
console.log('Next steps:');
console.log('1. Fix any missing database configuration');
console.log('2. Run: node run-production-wallet-migrations.js');