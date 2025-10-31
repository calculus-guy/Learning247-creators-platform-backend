require('dotenv').config();
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const sequelize = require('./config/db');
const cors = require('cors');
const bodyParser = require('body-parser');
const registrationRoutes = require('./routes/registrationRoutes');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
app.use(express.json());

app.use(cors());
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

// Database connection and server start
const PORT = process.env.PORT || 8080;
sequelize.sync({ alter: false })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => console.error(' DB Connection Failed:', err));