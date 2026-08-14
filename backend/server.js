const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables from the workspace root directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Utils & routes
const seedSuperAdmin = require('./utils/seedSuperAdmin');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const { initChatSocket } = require('./socket/chatSocket');
const { initCleanupCron } = require('./jobs/cleanupCron');

// Verify environment variables are present (log presence, not actual values)
const requiredEnvVars = [
  'MONGODB_URI',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'JWT_SECRET',
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PASSWORD'
];

console.log('--- Environment Verification ---');
requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`[OK] ${envVar} is configured.`);
  } else {
    console.warn(`[WARNING] ${envVar} is missing or undefined!`);
  }
});
console.log('--------------------------------');

const allowedOrigins = [
  'https://classbridge.pages.dev',
  'http://localhost:8081',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.classbridge.pages.dev')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.classbridge.pages.dev')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiter for API endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', limiter);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/classbridge';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to MongoDB.');
    // Seed Super Admin on first start (idempotent — skips if already exists)
    await seedSuperAdmin();
    // Initialize scheduled storage cleanup cron job (runs daily at 2:00 AM)
    initCleanupCron();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io connection logic
initChatSocket(io);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

// GET /api/health returning { status: "ok", uptime: process.uptime() }
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime()
  });
});

app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[ERROR]', err.message);
  return res.status(err.status || 500).json({
    error: isDev ? err.message : 'An internal server error occurred.',
    ...(isDev && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`ClassBridge backend running on port ${PORT}`);
});
