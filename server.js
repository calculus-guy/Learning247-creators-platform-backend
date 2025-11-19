const dotenv = require("dotenv");
dotenv.config();

const express = require('express');
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
const liveRoutes = require('./routes/liveRoutes');

const app = express();
app.use(express.json());

const allowedOrigins = [
  'https://www.aahbibi.com', 
  'https://aahbibi.com',
  'http://localhost:3000' 
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, 
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions)); 


app.use('/api/webhooks', webhookRoutes);

// NOTE: bodyParser.json() is redundant if you already use app.use(express.json())
// I'll keep it commented out for security/clarity.
// app.use(bodyParser.json()); 


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);

app.use('/register', rateLimiter);

app.use('/event', registrationRoutes);

app.use('/live', liveRoutes);

app.use('/uploads', express.static('uploads'));

app.use('/videos', videoRoutes)

const PORT = process.env.PORT || 8080;
sequelize.sync({ force: false })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => console.error(' DB Connection Failed:', err));