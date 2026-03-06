import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // External APIs
  marketDataApiKey: process.env.MARKET_DATA_API_KEY || '',
  newsApiKey: process.env.NEWS_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  finnhubApiKey: process.env.FINNHUB_API_KEY || '',
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
  twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || '',
} as const;

export type Config = typeof config;
