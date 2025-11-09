const express = require('express');
const dotenv = require("dotenv");
const passport = require('passport');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const sequelize = require('./config/db');
const cors = require('cors');
const bodyParser = require('body-parser');
const registrationRoutes = require('./routes/registrationRoutes');
const rateLimiter = require('./middleware/rateLimiter');
const webhookRoutes = require('./routes/webhookRoutes');
const videoRoutes = require('./routes/videoRoutes')

const app = express();
app.use(express.json());

dotenv.config();

app.use(cors());

// Webhook route must come before JSON middleware
app.use('/api/webhooks', webhookRoutes);

app.use(bodyParser.json());

// Initialize session (needed by passport)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);

// Use rate limiter on the registration route
app.use('/register', rateLimiter);

// Register the routes
app.use('/event', registrationRoutes);

// Static folder for thumbnails upload via multer
app.use('/uploads', express.static('uploads'));

// Video routes
app.use('/videos', videoRoutes)

// Database connection and server start
const PORT = process.env.PORT || 8080;
sequelize.sync({ alter: false })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => console.error(' DB Connection Failed:', err));