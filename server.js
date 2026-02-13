const dotenv = require("dotenv");
dotenv.config();

const cors = require('cors');
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const videoRoutes = require('./routes/videoRoutes');
const liveRoutes = require('./routes/liveRoutes');
const zegoCloudRoutes = require('./routes/zegoCloudRoutes');
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const walletRoutes = require('./routes/walletRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseRoutes = require('./routes/courseRoutes');
const rateLimiter = require('./middleware/rateLimiter');
const sequelize = require('./config/db');
const LiveClassCleanupService = require('./services/liveClassCleanupService');

require('./models/walletIndex');
require('./models/courseIndex');

const app = express();

const allowedOrigins = [
  'https://www.aahbibi.com',
  'https://aahbibi.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://aistudio.google.com',
  'https://www.hallos.net',
  'https://hallos.net',
  'https://www.quiz.hallos.net'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS blocked: " + origin), false);
  },
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
       
app.use(
  "/api/webhooks", webhookRoutes
);

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/auth', passwordResetRoutes); //  Password reset routes
app.use('/register', rateLimiter);
app.use('/event', registrationRoutes);
app.use('/live', liveRoutes);
app.use('/api/live/zegocloud', zegoCloudRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

app.use('/uploads', express.static('uploads'));

app.use('/videos', videoRoutes);


const PORT = process.env.PORT || 8080;
     
sequelize.sync({ force: false })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      
      setupLiveClassCleanup();
    });
  })
  .catch(err => console.error('DB Connection Failed:', err));

/**
 * Setup automated live class cleanup cron jobs
 */
function setupLiveClassCleanup() {
  const cleanupService = new LiveClassCleanupService();
  
  // 🕐 Every hour: Auto-end stale live classes
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🧹 [Cron] Running hourly live class cleanup...');
      const result = await cleanupService.autoEndStaleLiveClasses();
      
      if (result.endedCount > 0) {
        console.log(`✅ [Cron] Auto-ended ${result.endedCount} stale live classes`);
      }
      
      if (result.errors.length > 0) {
        console.error(`⚠️ [Cron] ${result.errors.length} cleanup errors occurred`);
      }
    } catch (error) {
      console.error('❌ [Cron] Hourly cleanup failed:', error.message);
    }
  });
  
  // 🗓️ Every Sunday at 2 AM: Archive old ended classes
  cron.schedule('0 2 * * 0', async () => {
    try {
      console.log('🗄️ [Cron] Running weekly archive cleanup...');
      const result = await cleanupService.archiveOldEndedClasses();
      
      if (result.archivedCount > 0) {
        console.log(`📦 [Cron] Archived ${result.archivedCount} old classes`);
      }
    } catch (error) {
      console.error('❌ [Cron] Weekly archive failed:', error.message);
    }
  });
  
  console.log('⏰ Live class cleanup cron jobs scheduled:');
  console.log('   - Hourly: Auto-end stale live classes');
  console.log('   - Weekly: Archive old ended classes');
}
  