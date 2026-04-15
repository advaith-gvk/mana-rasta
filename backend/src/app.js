require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initFirebase } = require('./config/firebase');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { globalRateLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const acknowledgmentRoutes = require('./routes/acknowledgments');
const rewardsRoutes = require('./routes/rewards');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const geoRoutes = require('./routes/geo');

// Background jobs
const { startAllJobs } = require('./jobs');

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(globalRateLimiter);

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.APP_VERSION || '1.0.0',
}));

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/acknowledgments', acknowledgmentRoutes);
app.use('/api/v1/rewards', rewardsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/geo', geoRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    await connectDB();
    await connectRedis();
    await initFirebase();
    startAllJobs();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Bootstrap failed', err);
    process.exit(1);
  }
}

bootstrap();

module.exports = app; // for tests
