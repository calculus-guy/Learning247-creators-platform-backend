# Learning247 Creators Platform - Backend API

> A comprehensive, production-ready backend system for educational content creators to monetize their content through videos, live classes, and courses with multi-currency support and advanced security features.

**Production URL**: `https://prod-api.aahbibi.com`

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Security Features](#security-features)
- [Payment Integration](#payment-integration)
- [Live Streaming](#live-streaming)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🎯 Overview

Learning247 is an enterprise-grade platform that enables content creators to:
- Upload and monetize video content via Mux streaming
- Host live classes with ZegoCloud integration
- Sell courses with automated enrollment management
- Manage earnings with multi-currency wallet system
- Process payments through Paystack (NGN) and Stripe (USD)

---

## ✨ Key Features

### 🎥 Content Management
- **Video Streaming**: Mux-powered video upload, transcoding, and adaptive streaming
- **Live Classes**: Real-time live streaming with ZegoCloud (Mux support available)
- **Course Marketplace**: 24+ departments with 1000+ courses
- **Access Control**: Middleware-based content protection with purchase verification
- **Analytics**: Video view tracking and engagement metrics

### 💰 Payment & Monetization
- **Dual Gateway Support**: Paystack (NGN) and Stripe (USD) with automatic routing
- **Multi-Currency Wallets**: Support for USD, NGN, GBP, EUR, and more
- **Smart Payment Routing**: Currency-based gateway selection
- **Idempotency Protection**: Prevents duplicate charges
- **Webhook Security**: Signature verification for all payment callbacks
- **Platform Fees**: Configurable revenue sharing (default 20%)

### 👛 Wallet System
- **Multi-Currency Accounts**: Separate balances per currency
- **Real-Time Balance Tracking**: Instant balance updates
- **Withdrawal Management**: Bank transfer integration with 2FA
- **Withdrawal Limits**: Configurable daily/transaction limits
- **Transaction History**: Complete audit trail with CSV export
- **Currency Isolation**: Prevents cross-currency transaction errors

### 🔐 Security & Compliance
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **OAuth 2.0**: Google OAuth integration
- **Rate Limiting**: Redis-backed rate limiting on sensitive endpoints
- **Fraud Detection**: Real-time transaction monitoring
- **2FA for Withdrawals**: OTP verification for financial operations
- **Audit Trails**: Complete logging of all financial transactions
- **Input Validation**: Joi-based request validation
- **CORS Protection**: Whitelist-based origin control

### 🛠️ Advanced Features
- **Idempotency Middleware**: Prevents duplicate operations
- **Manual Review Queue**: Flagged transactions for admin review
- **Financial Rate Limiting**: Specialized limits for payment endpoints
- **Automated Cleanup**: Cron jobs for stale live class management
- **Database Transactions**: ACID-compliant financial operations
- **Property-Based Testing**: Fast-check for critical payment flows

---

## 🚀 Tech Stack

### Core Technologies
- **Runtime**: Node.js (v14+)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL with Sequelize ORM
- **Cache/Queue**: Redis
- **Authentication**: JWT + Passport.js

### Third-Party Services
- **Video Streaming**: Mux
- **Live Streaming**: ZegoCloud, Mux Live
- **Payments**: Paystack, Stripe
- **Storage**: AWS S3
- **Email**: Nodemailer

### Development Tools
- **Testing**: Jest, Supertest, Fast-check
- **Process Manager**: PM2 (ecosystem.config.js)
- **Validation**: Joi, Express-validator
- **Security**: bcrypt, cookie-parser

---

## 🏁 Getting Started

### Prerequisites

```bash
# Required
- Node.js v14 or higher
- PostgreSQL 12+
- Redis (for rate limiting)

# Optional (for full functionality)
- AWS account (S3 storage)
- Mux account (video streaming)
- ZegoCloud account (live streaming)
- Paystack account (NGN payments)
- Stripe account (USD payments)
```

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/learning247

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key
SESSION_SECRET=your_session_secret_key

# OAuth (Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://prod-api.aahbibi.com/auth/google/callback

# Payment Gateways
PAYSTACK_SECRET_KEY=sk_live_your_paystack_secret
STRIPE_SECRET_KEY=sk_live_your_stripe_secret

# Video Streaming (Mux)
MUX_TOKEN_ID=your_mux_token_id
MUX_TOKEN_SECRET=your_mux_token_secret

# Live Streaming (ZegoCloud)
ZEGO_APP_ID=your_zego_app_id
ZEGO_SERVER_SECRET=your_zego_server_secret

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your_bucket_name

# Redis (Rate Limiting)
REDIS_URL=redis://localhost:6379

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password

# Frontend URLs (CORS)
FRONTEND_URL=https://www.hallos.net
```

4. **Run database migrations**
```bash
npx sequelize-cli db:migrate
```

5. **Seed admin user (optional)**
```bash
node seed-admin.js
```

6. **Import courses (optional)**
```bash
node scripts/importCourses.js
```

### Running the Application

**Development Mode**
```bash
npm run dev
```

**Production Mode**
```bash
npm start
```

**With PM2**
```bash
pm2 start ecosystem.config.js
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/payment-routing.test.js
```

---

## 📁 Project Structure

```
backend/
├── config/                      # Configuration files
│   ├── database.js             # Sequelize config
│   ├── db.js                   # Database connection
│   ├── mux.js                  # Mux client setup
│   ├── paystack.js             # Paystack config
│   └── stripe.js               # Stripe config
│
├── controllers/                 # Request handlers
│   ├── authController.js       # Authentication logic
│   ├── courseController.js     # Course management
│   ├── liveController.js       # Live class management
│   ├── paymentController.js    # Payment processing
│   ├── videoController.js      # Video management
│   ├── walletController.js     # Wallet operations
│   ├── zegoCloudController.js  # ZegoCloud integration
│   └── ...                     # Other controllers
│
├── middleware/                  # Express middleware
│   ├── authMiddleware.js       # JWT verification
│   ├── adminMiddleware.js      # Admin authorization
│   ├── rateLimiter.js          # General rate limiting
│   ├── financialRateLimiter.js # Payment rate limiting
│   ├── fraudDetectionMiddleware.js
│   ├── idempotencyMiddleware.js
│   ├── purchaseMiddleware.js   # Content access control
│   ├── zegoCloudMiddleware.js  # Live class access
│   └── ...                     # Other middleware
│
├── models/                      # Sequelize models
│   ├── User.js                 # User model
│   ├── Course.js               # Course model
│   ├── CourseEnrollment.js     # Enrollment tracking
│   ├── liveClass.js            # Live class model
│   ├── Video.js                # Video model
│   ├── Purchase.js             # Purchase records
│   ├── Wallet.js               # Wallet model
│   ├── WalletAccount.js        # Multi-currency accounts
│   ├── Transaction.js          # Transaction history
│   └── ...                     # Other models
│
├── services/                    # Business logic layer
│   ├── paymentService.js       # Payment processing
│   ├── paymentRoutingService.js # Gateway routing
│   ├── walletService.js        # Wallet operations
│   ├── multiCurrencyWalletService.js
│   ├── courseService.js        # Course logic
│   ├── videoService.js         # Video processing
│   ├── zegoCloudService.js     # Live streaming
│   ├── fraudDetectionService.js
│   ├── idempotencyService.js
│   └── ...                     # Other services
│
├── routes/                      # API route definitions
│   ├── authRoutes.js
│   ├── courseRoutes.js
│   ├── liveRoutes.js
│   ├── paymentRoutes.js
│   ├── videoRoutes.js
│   ├── walletRoutes.js
│   ├── webhookRoutes.js
│   └── ...
│
├── migrations/                  # Database migrations
│   └── *.js                    # Migration files
│
├── tests/                       # Test suites
│   ├── properties/             # Property-based tests
│   │   ├── idempotency.property.test.js
│   │   ├── transaction-atomicity.property.test.js
│   │   └── ...
│   ├── payment-routing.test.js
│   ├── multi-currency-wallet.test.js
│   ├── zegocloud-integration.test.js
│   └── ...
│
├── utils/                       # Helper utilities
│   ├── email.js                # Email sending
│   ├── validator.js            # Input validation
│   ├── zegoServerAssistant.js  # ZegoCloud helpers
│   └── ...
│
├── scripts/                     # Utility scripts
│   └── importCourses.js        # Bulk course import
│
├── .env                         # Environment variables
├── .sequelizerc                # Sequelize CLI config
├── ecosystem.config.js         # PM2 configuration
├── server.js                   # Application entry point
└── package.json                # Dependencies
```

---

## 📚 API Documentation

### Base URL
```
Production: https://prod-api.aahbibi.com
Development: http://localhost:8080
```

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/google` - Google OAuth login
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Reset password with token

#### Courses
- `GET /api/courses/departments` - List all departments
- `GET /api/courses/departments/:id/courses` - Get courses by department
- `GET /api/courses/:id` - Get course details
- `GET /api/courses/search` - Search courses
- `POST /api/courses/:id/purchase` - Purchase a course (requires auth)
- `GET /api/courses/my-enrollments` - Get user enrollments (requires auth)

#### Videos
- `POST /videos/upload` - Upload video (requires auth)
- `GET /videos` - List user's videos (requires auth)
- `GET /videos/:id` - Get video details
- `DELETE /videos/:id` - Delete video (requires auth)

#### Live Classes
- `POST /live/create` - Create live class (requires auth)
- `GET /live` - List live classes
- `GET /live/:id` - Get live class details
- `POST /live/:id/start` - Start live class (requires auth)
- `POST /live/:id/end` - End live class (requires auth)

#### ZegoCloud Live
- `POST /api/live/zegocloud/token` - Generate ZegoCloud token (requires auth + purchase)
- `POST /api/live/zegocloud/room/create` - Create ZegoCloud room (requires auth)
- `GET /api/live/zegocloud/room/:id/status` - Get room status

#### Payments
- `POST /api/payments/initialize` - Initialize payment (requires auth)
- `POST /api/payments/verify/:reference` - Verify payment
- `POST /api/webhooks/paystack` - Paystack webhook
- `POST /api/webhooks/stripe` - Stripe webhook

#### Wallet
- `GET /api/wallet/balance` - Get wallet balance (requires auth)
- `GET /api/wallet/transactions` - Get transaction history (requires auth)
- `POST /api/wallet/withdraw` - Request withdrawal (requires auth + 2FA)
- `GET /api/wallet/export` - Export transactions as CSV (requires auth)

#### Admin
- `GET /api/admin/course-enrollments` - List all enrollments (requires admin)
- `PATCH /api/admin/course-enrollments/:id/mark-sent` - Mark credentials sent (requires admin)
- `GET /api/admin/course-enrollments/stats` - Get enrollment statistics (requires admin)

For complete API documentation, see [COURSE_MARKETPLACE_API_DOCUMENTATION.md](./COURSE_MARKETPLACE_API_DOCUMENTATION.md)

---

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with secure token generation
- Google OAuth 2.0 integration
- Role-based access control (user, admin)
- Password hashing with bcrypt

### Rate Limiting
```javascript
// General endpoints: 100 requests per 15 minutes
// Payment endpoints: 10 requests per 15 minutes
// Admin endpoints: 200 requests per 15 minutes
```

### Payment Security
- Idempotency keys for all payment operations
- Webhook signature verification (Paystack & Stripe)
- Fraud detection with configurable thresholds
- Manual review queue for suspicious transactions
- 2FA for withdrawals via OTP

### Data Protection
- Input validation on all endpoints
- SQL injection prevention via Sequelize ORM
- CORS with whitelist-based origin control
- Secure cookie handling (httpOnly, secure, sameSite)

---

## 💳 Payment Integration

### Supported Gateways
- **Paystack**: Nigerian Naira (NGN) payments
- **Stripe**: USD, GBP, EUR payments

### Payment Flow
1. User initiates purchase → `POST /api/payments/initialize`
2. System routes to appropriate gateway based on currency
3. User completes payment on gateway
4. Gateway sends webhook → `/api/webhooks/paystack` or `/api/webhooks/stripe`
5. System verifies webhook signature
6. Creates purchase record and grants access
7. Updates creator wallet with earnings (80% of amount)

### Currency Routing
```javascript
NGN → Paystack
USD, GBP, EUR → Stripe
```

### Idempotency
All payment operations require an `Idempotency-Key` header to prevent duplicate charges:
```
Idempotency-Key: unique-operation-id-12345
```

---

## 🎬 Live Streaming

### Supported Providers
- **ZegoCloud**: Primary live streaming provider
- **Mux Live**: Alternative streaming option

### ZegoCloud Integration
- Real-time video/audio streaming
- Room-based architecture
- Token-based access control
- Participant management
- Privacy enforcement
- Automatic room cleanup

### Live Class Lifecycle
1. Creator creates live class → `POST /live/create`
2. System generates ZegoCloud room
3. Creator starts class → `POST /live/:id/start`
4. Students join with access tokens → `POST /api/live/zegocloud/token`
5. Creator ends class → `POST /live/:id/end`
6. Automated cleanup runs hourly via cron job

---

## 🧪 Testing

### Test Suites
- **Unit Tests**: Controller and service logic
- **Integration Tests**: API endpoint testing
- **Property-Based Tests**: Critical payment flows with fast-check

### Running Tests
```bash
# All tests
npm test

# Specific test suite
npm test -- tests/payment-routing.test.js

# Property-based tests (note: can be slow)
npm test -- tests/properties/
```

### Test Coverage
- Payment routing and gateway selection
- Multi-currency wallet operations
- Idempotency enforcement
- Transaction atomicity
- Withdrawal limits
- ZegoCloud integration

---

## 🚀 Deployment

### Production Server
```bash
# SSH into server
ssh -i "autoware.pem" ubuntu@34.251.237.6

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations
npx sequelize-cli db:migrate

# Restart with PM2
pm2 restart ecosystem.config.js
```

### PM2 Configuration
The application uses PM2 for process management. See `ecosystem.config.js` for configuration.

```bash
# Start application
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit

# Restart
pm2 restart all
```

### Environment
- **Production URL**: https://prod-api.aahbibi.com
- **Frontend URL**: https://www.hallos.net
- **Server**: AWS EC2 (Ubuntu)

---

## 🤝 Contributing

### Development Workflow
1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Run tests locally
5. Submit pull request

### Code Style
- Use ES6+ features
- Follow existing code structure
- Add JSDoc comments for functions
- Use meaningful variable names
- Keep functions small and focused

### Commit Messages
```
feat: Add multi-currency wallet support
fix: Resolve payment webhook signature verification
docs: Update API documentation
test: Add property-based tests for idempotency
```

---

## 📝 License

ISC

---

## 👨‍💻 Author

**Abdul-Lateef**

---

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Contact the development team

---

## 🔄 Automated Tasks

### Cron Jobs
- **Hourly**: Auto-end stale live classes
- **Weekly**: Archive old ended classes

### Cleanup Service
The system automatically manages live class lifecycle:
- Ends classes that exceed scheduled duration
- Archives classes older than 30 days
- Cleans up orphaned ZegoCloud rooms

---

**Built with ❤️ for content creators**