import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import { pushService, PushMessage } from './pushService.js';
import { CACHE_KEYS, CACHE_TTL } from '../lib/cache-keys.js';

export interface SectorInfo {
  id: string;
  name: string;
  nameZh: string;
  description: string | null;
  stockCount: number;
  isSubscribed?: boolean;
}

export interface SectorNews {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  publishedAt: Date;
  symbols: string[];
}

export interface SectorPerformance {
  sectorId: string;
  name: string;
  nameZh: string;
  changePercent: number;
  topGainers: { symbol: string; name: string; changePercent: number }[];
  topLosers: { symbol: string; name: string; changePercent: number }[];
}

export class SectorSubscriptionService {
  private redis = getRedisClient();

  /**
   * 获取所有板块列表
   */
  async getAllSectors(userId?: string): Promise<SectorInfo[]> {
    try {
      const sectors = await prisma.sector.findMany({
        orderBy: { nameZh: 'asc' },
      });

      // 如果提供了用户ID，获取订阅状态
      let subscribedSectorIds: Set<string> = new Set();
      if (userId) {
        const subscriptions = await prisma.sectorSubscription.findMany({
          where: { userId },
          select: { sectorId: true },
        });
        subscribedSectorIds = new Set(subscriptions.map((s) => s.sectorId));
      }

      return sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        nameZh: sector.nameZh,
        description: sector.description,
        stockCount: sector.stockCount,
        isSubscribed: userId ? subscribedSectorIds.has(sector.id) : undefined,
      }));
    } catch (error) {
      logger.error('获取板块列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取板块详情
   */
  async getSectorById(sectorId: string, userId?: string): Promise<SectorInfo | null> {
    try {
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
      });

      if (!sector) {
        return null;
      }

      let isSubscribed: boolean | undefined;
      if (userId) {
        const subscription = await prisma.sectorSubscription.findUnique({
          where: {
            userId_sectorId: { userId, sectorId },
          },
        });
        isSubscribed = !!subscription;
      }

      return {
        id: sector.id,
        name: sector.name,
        nameZh: sector.nameZh,
        description: sector.description,
        stockCount: sector.stockCount,
        isSubscribed,
      };
    } catch (error) {
      logger.error(`获取板块详情失败 (${sectorId}):`, error);
      throw error;
    }
  }


  /**
   * 订阅板块
   */
  async subscribeSector(userId: string, sectorId: string): Promise<void> {
    try {
      // 检查板块是否存在
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
      });

      if (!sector) {
        throw new Error('板块不存在');
      }

      // 创建订阅（如果已存在则忽略）
      await prisma.sectorSubscription.upsert({
        where: {
          userId_sectorId: { userId, sectorId },
        },
        create: {
          userId,
          sectorId,
        },
        update: {},
      });

      // 订阅 WebSocket 房间
      await pushService.subscribeSector(userId, sector.name);

      logger.info(`用户 ${userId} 订阅板块 ${sector.nameZh}`);
    } catch (error) {
      logger.error(`订阅板块失败 (userId: ${userId}, sectorId: ${sectorId}):`, error);
      throw error;
    }
  }

  /**
   * 取消订阅板块
   */
  async unsubscribeSector(userId: string, sectorId: string): Promise<void> {
    try {
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
      });

      if (!sector) {
        throw new Error('板块不存在');
      }

      await prisma.sectorSubscription.delete({
        where: {
          userId_sectorId: { userId, sectorId },
        },
      });

      // 取消 WebSocket 房间订阅
      await pushService.unsubscribeSector(userId, sector.name);

      logger.info(`用户 ${userId} 取消订阅板块 ${sector.nameZh}`);
    } catch (error) {
      // 如果记录不存在，忽略错误
      if ((error as any).code === 'P2025') {
        return;
      }
      logger.error(`取消订阅板块失败 (userId: ${userId}, sectorId: ${sectorId}):`, error);
      throw error;
    }
  }

  /**
   * 获取用户订阅的板块列表
   */
  async getUserSubscriptions(userId: string): Promise<SectorInfo[]> {
    try {
      const subscriptions = await prisma.sectorSubscription.findMany({
        where: { userId },
        include: { sector: true },
        orderBy: { subscribedAt: 'desc' },
      });

      return subscriptions.map((sub) => ({
        id: sub.sector.id,
        name: sub.sector.name,
        nameZh: sub.sector.nameZh,
        description: sub.sector.description,
        stockCount: sub.sector.stockCount,
        isSubscribed: true,
      }));
    } catch (error) {
      logger.error(`获取用户订阅列表失败 (userId: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 获取板块内的股票列表
   */
  async getSectorStocks(
    sectorName: string,
    options: { limit?: number; sortBy?: 'marketCap' | 'changePercent' } = {}
  ): Promise<{ symbol: string; name: string; marketCap: bigint | null; changePercent?: number }[]> {
    const { limit = 50, sortBy = 'marketCap' } = options;

    try {
      const stocks = await prisma.stock.findMany({
        where: { sector: sectorName },
        select: {
          symbol: true,
          name: true,
          marketCap: true,
          quotes: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: { changePercent: true },
          },
        },
        orderBy: sortBy === 'marketCap' ? { marketCap: 'desc' } : undefined,
        take: limit,
      });

      let result = stocks.map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        marketCap: stock.marketCap,
        changePercent: stock.quotes[0]?.changePercent,
      }));

      // 如果按涨跌幅排序
      if (sortBy === 'changePercent') {
        result = result.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
      }

      return result;
    } catch (error) {
      logger.error(`获取板块股票列表失败 (sector: ${sectorName}):`, error);
      throw error;
    }
  }


  /**
   * 获取板块相关新闻
   */
  async getSectorNews(sectorName: string, limit = 20): Promise<SectorNews[]> {
    try {
      const cacheKey = `${CACHE_KEYS.SECTOR_NEWS}:${sectorName}`;

      // 尝试从缓存获取
      if (this.redis.status === 'ready') {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // 从数据库获取
      const newsItems = await prisma.newsItem.findMany({
        where: {
          sectors: { has: sectorName },
        },
        include: {
          stocks: {
            select: { symbol: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      });

      const result: SectorNews[] = newsItems.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        publishedAt: item.publishedAt,
        symbols: item.stocks.map((s) => s.symbol),
      }));

      // 缓存结果
      if (this.redis.status === 'ready') {
        await this.redis.setex(cacheKey, CACHE_TTL.SECTOR_NEWS || 300, JSON.stringify(result));
      }

      return result;
    } catch (error) {
      logger.error(`获取板块新闻失败 (sector: ${sectorName}):`, error);
      throw error;
    }
  }

  /**
   * 获取板块表现数据
   */
  async getSectorPerformance(sectorId: string): Promise<SectorPerformance | null> {
    try {
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
      });

      if (!sector) {
        return null;
      }

      // 获取板块内所有股票的最新行情
      const stocks = await prisma.stock.findMany({
        where: { sector: sector.name },
        select: {
          symbol: true,
          name: true,
          quotes: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: { changePercent: true },
          },
        },
      });

      const stocksWithChange = stocks
        .map((stock) => ({
          symbol: stock.symbol,
          name: stock.name,
          changePercent: stock.quotes[0]?.changePercent || 0,
        }))
        .filter((s) => s.changePercent !== 0 && Math.abs(s.changePercent) <= 100);  // Filter out extreme values

      // 计算板块平均涨跌幅
      const avgChange =
        stocksWithChange.length > 0
          ? stocksWithChange.reduce((sum, s) => sum + s.changePercent, 0) / stocksWithChange.length
          : 0;

      // 排序获取涨幅榜和跌幅榜 (only positive for gainers, only negative for losers)
      const gainers = stocksWithChange.filter(s => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent);
      const losers = stocksWithChange.filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent);

      return {
        sectorId: sector.id,
        name: sector.name,
        nameZh: sector.nameZh,
        changePercent: Math.round(avgChange * 100) / 100,
        topGainers: gainers.slice(0, 5),
        topLosers: losers.slice(0, 5),
      };
    } catch (error) {
      logger.error(`获取板块表现失败 (sectorId: ${sectorId}):`, error);
      throw error;
    }
  }

  /**
   * 推送板块重大新闻
   */
  async pushSectorNews(sectorName: string, news: { title: string; summary: string }): Promise<void> {
    try {
      const sector = await prisma.sector.findUnique({
        where: { name: sectorName },
      });

      if (!sector) {
        logger.warn(`板块不存在: ${sectorName}`);
        return;
      }

      const message: PushMessage = {
        type: 'news',
        sector: sectorName,
        title: `${sector.nameZh}板块动态`,
        message: news.title,
        priority: 'medium',
        metadata: {
          summary: news.summary,
          sectorId: sector.id,
        },
      };

      // 广播给订阅该板块的用户
      await pushService.broadcastToSector(sectorName, message);

      logger.info(`推送板块新闻: ${sector.nameZh} - ${news.title}`);
    } catch (error) {
      logger.error(`推送板块新闻失败 (sector: ${sectorName}):`, error);
      throw error;
    }
  }

  /**
   * 初始化默认板块数据
   */
  async initializeDefaultSectors(): Promise<void> {
    const defaultSectors = [
      { name: 'Technology', nameZh: '科技', description: '科技行业板块' },
      { name: 'Healthcare', nameZh: '医疗保健', description: '医疗保健行业板块' },
      { name: 'Financial', nameZh: '金融', description: '金融行业板块' },
      { name: 'Consumer Cyclical', nameZh: '可选消费', description: '可选消费行业板块' },
      { name: 'Consumer Defensive', nameZh: '必需消费', description: '必需消费行业板块' },
      { name: 'Energy', nameZh: '能源', description: '能源行业板块' },
      { name: 'Industrials', nameZh: '工业', description: '工业行业板块' },
      { name: 'Basic Materials', nameZh: '基础材料', description: '基础材料行业板块' },
      { name: 'Real Estate', nameZh: '房地产', description: '房地产行业板块' },
      { name: 'Utilities', nameZh: '公用事业', description: '公用事业行业板块' },
      { name: 'Communication Services', nameZh: '通信服务', description: '通信服务行业板块' },
    ];

    try {
      for (const sector of defaultSectors) {
        await prisma.sector.upsert({
          where: { name: sector.name },
          create: sector,
          update: { nameZh: sector.nameZh, description: sector.description },
        });
      }

      logger.info('默认板块数据初始化完成');
    } catch (error) {
      logger.error('初始化默认板块数据失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const sectorSubscriptionService = new SectorSubscriptionService();
