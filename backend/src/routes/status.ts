import { Router, Request, Response } from 'express';
import { finnhubService } from '../services/finnhubService.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

/**
 * GET /api/status/finnhub
 * Get Finnhub WebSocket connection status
 */
router.get('/finnhub', (_req: Request, res: Response): void => {
  const isConnected = finnhubService.isWebSocketConnected();
  
  const response: ApiResponse = {
    success: true,
    data: {
      websocket: {
        connected: isConnected,
        status: isConnected ? 'streaming' : 'disconnected',
      },
      description: isConnected 
        ? '实时数据流已连接，价格将自动更新'
        : 'WebSocket 未连接，使用 REST API 获取数据',
    },
    message: isConnected ? 'Finnhub 实时流已连接' : 'Finnhub 实时流未连接',
  };

  res.status(200).json(response);
});

/**
 * GET /api/status
 * Get overall system status
 */
router.get('/', (_req: Request, res: Response): void => {
  const finnhubConnected = finnhubService.isWebSocketConnected();
  
  const response: ApiResponse = {
    success: true,
    data: {
      services: {
        finnhub: {
          websocket: finnhubConnected,
          status: finnhubConnected ? 'streaming' : 'rest-only',
        },
      },
      timestamp: new Date().toISOString(),
    },
    message: '系统状态正常',
  };

  res.status(200).json(response);
});

export default router;
