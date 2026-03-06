import { createServer } from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initializeSocketIO, closeSocketIO } from './lib/socket.js';
import { connectDatabase, disconnectDatabase } from './lib/prisma.js';
import { getRedisClient, closeRedisConnection } from './lib/redis.js';
import { priceMonitorService } from './services/priceMonitorService.js';
import { finnhubService } from './services/finnhubService.js';

// Main server startup function
const startServer = async (): Promise<void> => {
  try {
    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(httpServer);

    // Connect to database (optional - will fail gracefully if not configured)
    try {
      await connectDatabase();
    } catch (error) {
      logger.warn('Database connection failed. Some features may be unavailable.', error);
    }

    // Connect to Redis (optional - will fail gracefully if not configured)
    try {
      const redis = getRedisClient();
      await redis.connect();
    } catch (error) {
      logger.warn('Redis connection failed. Caching will be disabled.', error);
    }

    // Start price monitoring service
    try {
      priceMonitorService.startMonitoring(60000); // Check every minute
      logger.info('Price monitoring service started');
    } catch (error) {
      logger.warn('Failed to start price monitoring service:', error);
    }

    // Initialize Finnhub WebSocket for real-time streaming
    try {
      await finnhubService.initWebSocket();
      await finnhubService.subscribeAllTrackedStocks();
      logger.info('🔴 Finnhub real-time streaming initialized');
    } catch (error) {
      logger.warn('Failed to initialize Finnhub WebSocket:', error);
    }

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 Health check: http://localhost:${config.port}/health`);
      logger.info(`📡 API endpoint: http://localhost:${config.port}/api`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Close HTTP server
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      // Close Socket.IO
      closeSocketIO();

      // Stop price monitoring
      priceMonitorService.stopMonitoring();

      // Close Finnhub WebSocket
      finnhubService.closeWebSocket();

      // Close database connection
      await disconnectDatabase();

      // Close Redis connection
      await closeRedisConnection();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
