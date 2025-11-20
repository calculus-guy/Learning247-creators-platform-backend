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


const allowedOrigins = [
  'https://www.aahbibi.com',
  'https://aahbibi.com',
  'http://localhost:3000' 
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


app.use('/api/webhooks', webhookRoutes);
app.use(express.json());
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