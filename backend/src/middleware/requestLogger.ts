import morgan from 'morgan';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Create a stream object for morgan to use winston
const stream = {
  write: (message: string) => {
    // Remove newline character from morgan output
    logger.info(message.trim());
  },
};

// Custom morgan format for development
const devFormat = ':method :url :status :response-time ms - :res[content-length]';

// Custom morgan format for production (more detailed)
const prodFormat =
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

// Request logger middleware
export const requestLogger = morgan(config.nodeEnv === 'production' ? prodFormat : devFormat, {
  stream,
  // Skip logging for health check endpoints
  skip: (req) => {
    return req.url === '/health' || req.url === '/api/health';
  },
});
