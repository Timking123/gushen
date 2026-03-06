import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Create Prisma client with logging
const createPrismaClient = (): PrismaClient => {
  const prisma = new PrismaClient({
    log:
      config.nodeEnv === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  return prisma;
};

// Singleton Prisma instance
let prismaClient: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
  }
  return prismaClient;
};

// Alias for convenience
export const prisma = getPrismaClient();

// Connect to database
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

// Disconnect from database
export const disconnectDatabase = async (): Promise<void> => {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
    logger.info('Database disconnected gracefully');
  }
};
