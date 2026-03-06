import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let io: SocketIOServer | null = null;

// WebSocket configuration (Requirements 5.1, 5.2)
export const WS_CONFIG = {
  pingInterval: 25000,   // 心跳间隔：每25秒发送一次ping
  pingTimeout: 60000,    // 心跳超时：60秒内未收到响应则关闭连接
  maxReconnectAttempts: 10,
  reconnectInterval: 1000,
} as const;

// Initialize Socket.IO server
export const initializeSocketIO = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: WS_CONFIG.pingTimeout,
    pingInterval: WS_CONFIG.pingInterval,
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Notify client of connection state (Requirement 5.6)
    socket.emit('connection:state', { status: 'connected', socketId: socket.id });

    // Handle user authentication
    socket.on('authenticate', async (userId: string) => {
      socket.join(`user:${userId}`);
      socket.data.userId = userId;
      logger.debug(`User ${userId} authenticated on socket ${socket.id}`);
      
      // Mark user as online and deliver cached messages
      try {
        const { pushService } = await import('../services/pushService.js');
        await pushService.markUserOnline(userId);
        await pushService.deliverCachedMessages(userId);
      } catch (error) {
        logger.error(`Failed to handle user online for ${userId}:`, error);
      }
    });

    // Handle stock subscription
    socket.on('subscribe:stock', (symbol: string) => {
      socket.join(`stock:${symbol}`);
      logger.debug(`Socket ${socket.id} subscribed to stock ${symbol}`);
    });

    // Handle stock unsubscription
    socket.on('unsubscribe:stock', (symbol: string) => {
      socket.leave(`stock:${symbol}`);
      logger.debug(`Socket ${socket.id} unsubscribed from stock ${symbol}`);
    });

    // Handle sector subscription
    socket.on('subscribe:sector', (sector: string) => {
      socket.join(`sector:${sector}`);
      logger.debug(`Socket ${socket.id} subscribed to sector ${sector}`);
    });

    // Handle sector unsubscription
    socket.on('unsubscribe:sector', (sector: string) => {
      socket.leave(`sector:${sector}`);
      logger.debug(`Socket ${socket.id} unsubscribed from sector ${sector}`);
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);

      // Notify client of disconnection state (Requirement 5.6)
      // Note: This is mainly for server-side logging; the client detects disconnect via socket.io
      
      // Mark user as offline if they were authenticated
      if (socket.data.userId) {
        try {
          const { pushService } = await import('../services/pushService.js');
          await pushService.markUserOffline(socket.data.userId);
        } catch (error) {
          logger.error(`Failed to handle user offline for ${socket.data.userId}:`, error);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
};

// Get Socket.IO instance
export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return io;
};

// Emit to specific user
export const emitToUser = (userId: string, event: string, data: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Emit to stock subscribers
export const emitToStock = (symbol: string, event: string, data: unknown): void => {
  if (io) {
    io.to(`stock:${symbol}`).emit(event, data);
  }
};

// Emit to sector subscribers
export const emitToSector = (sector: string, event: string, data: unknown): void => {
  if (io) {
    io.to(`sector:${sector}`).emit(event, data);
  }
};

// Broadcast to all connected clients
export const broadcast = (event: string, data: unknown): void => {
  if (io) {
    io.emit(event, data);
  }
};

// Close Socket.IO server
export const closeSocketIO = (): void => {
  if (io) {
    io.close();
    io = null;
    logger.info('Socket.IO server closed');
  }
};
