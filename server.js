// const dotenv = require("dotenv");
// dotenv.config();
// const cors = require('cors');

// const express = require('express');
// const passport = require('passport');
// const session = require('express-session');
// const authRoutes = require('./routes/authRoutes');
// const sequelize = require('./config/db');
// const registrationRoutes = require('./routes/registrationRoutes');
// const rateLimiter = require('./middleware/rateLimiter');
// const webhookRoutes = require('./routes/webhookRoutes');
// const videoRoutes = require('./routes/videoRoutes')
// const liveRoutes = require('./routes/liveRoutes');

// const app = express();

// // app.post(
// //   "/api/webhooks/mux",
// //   express.raw({ type: "application/json" })  // raw body BEFORE ANY parsing
// // );

// app.use(require('cookie-parser')());

// const allowedOrigins = [
//   'https://www.aahbibi.com',
//   'https://aahbibi.com',
//   'http://localhost:3000',
//   'http://localhost:3001',
//   "https://aistudio.google.com"
// ];

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("CORS blocked: Origin " + origin), false);
//     }
//   },
//   credentials: true,
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   optionsSuccessStatus: 200,
// };

// app.use(cors(corsOptions)); 

// app.use('/api/webhooks', webhookRoutes);

// app.use(express.json());


// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: true
// }));

// app.use(passport.initialize());
// app.use(passport.session());


// app.use('/auth', authRoutes);

// app.use('/register', rateLimiter);

// app.use('/event', registrationRoutes);

// app.use('/live', liveRoutes);

// app.use('/uploads', express.static('uploads'));

// app.use('/videos', videoRoutes)

// const PORT = process.env.PORT || 8080;
// sequelize.sync({ force: false })
//   .then(() => {
//     app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
//   })
//   .catch(err => console.error(' DB Connection Failed:', err));

const dotenv = require("dotenv");
dotenv.config();

const cors = require('cors');
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
// const webhookController = require('./controllers/muxController'); // IMPORTANT
const videoRoutes = require('./routes/videoRoutes');
const liveRoutes = require('./routes/liveRoutes');
const rateLimiter = require('./middleware/rateLimiter');
const sequelize = require('./config/db');

const app = express();

const allowedOrigins = [
  'https://www.aahbibi.com',
  'https://aahbibi.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://aistudio.google.com'
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
app.use('/register', rateLimiter);
app.use('/event', registrationRoutes);
app.use('/live', liveRoutes);

app.use('/uploads', express.static('uploads'));

app.use('/videos', videoRoutes);


const PORT = process.env.PORT || 8080;

sequelize.sync({ force: false })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    );
  })
  .catch(err => console.error('DB Connection Failed:', err));