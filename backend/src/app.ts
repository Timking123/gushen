import express, { Express } from 'express';
import helmet from 'helmet';
import { corsMiddleware, requestLogger, errorHandler, notFoundHandler, publicApiLimiter, requestIdMiddleware } from './middleware/index.js';
import { compressionMiddleware, cacheHeadersMiddleware, etagMiddleware, fieldSelectionMiddleware } from './middleware/responseOptimization.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import routes from './routes/index.js';
import { setupSwagger } from './config/swagger.js';

// Create Express application
export const createApp = (): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // Response optimization middleware (Requirement 14.1, 14.2, 14.3, 14.5)
  app.use(compressionMiddleware);
  app.use(cacheHeadersMiddleware);
  app.use(etagMiddleware);
  app.use(fieldSelectionMiddleware);

  // Request ID middleware — attaches a unique ID to every request
  app.use(requestIdMiddleware);

  // CORS middleware
  app.use(corsMiddleware);

  // Request logging
  app.use(requestLogger);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
      },
    });
  });

  // API health check
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // API routes placeholder - will be added in future tasks
  app.get('/api', (_req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Smart Stock Analyzer API',
        version: '1.0.0',
        documentation: '/api/docs',
      },
    });
  });

  // Setup Swagger UI for API documentation
  setupSwagger(app);

  // Mount API routes
  app.use('/api', publicApiLimiter, routes);

  // 404 handler for undefined routes
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  logger.info('Express application created');
  return app;
};
