import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import { analysisService } from './analysisService.js';
import { watchlistService } from './watchlistService.js';
import { newsService } from './newsService.js';
import { stockService } from './stockService.js';

export type IntentType =
  | 'add_watchlist'
  | 'remove_watchlist'
  | 'stock_info'
  | 'stock_compare'
  | 'news_summary'
  | 'sector_summary'
  | 'general_question'
  | 'unknown';

export interface ParsedIntent {
  type: IntentType;
  confidence: number;
  entities: {
    symbols?: string[];
    sectorName?: string;
    timeRange?: string;
    query?: string;
  };
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: ParsedIntent;
    actionTaken?: string;
    actionResult?: unknown;
  };
}

export interface AIConversation {
  id: string;
  userId: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIResponse {
  message: string;
  intent: ParsedIntent;
  actionTaken?: string;
  actionResult?: unknown;
  suggestions?: string[];
}

export class AIAssistantService {
  private redis = getRedisClient();
  private readonly CONVERSATION_TTL = 3600;

  parseIntent(message: string): ParsedIntent {
    const lowerMessage = message.toLowerCase();
    
    if (this.matchesPattern(lowerMessage, ['添加', '加入', '关注', '收藏']) &&
        this.matchesPattern(lowerMessage, ['自选', '关注列表', '收藏夹'])) {
      const symbols = this.extractSymbols(message);
      return { type: 'add_watchlist', confidence: symbols.length > 0 ? 0.9 : 0.6, entities: { symbols } };
    }

    if (this.matchesPattern(lowerMessage, ['删除', '移除', '取消关注', '移出']) &&
        this.matchesPattern(lowerMessage, ['自选', '关注列表', '收藏夹'])) {
      const symbols = this.extractSymbols(message);
      return { type: 'remove_watchlist', confidence: symbols.length > 0 ? 0.9 : 0.6, entities: { symbols } };
    }

    if (this.matchesPattern(lowerMessage, ['对比', '比较', '对照', 'vs', '和'])) {
      const symbols = this.extractSymbols(message);
      if (symbols.length >= 2) {
        return { type: 'stock_compare', confidence: 0.85, entities: { symbols } };
      }
    }

    if (this.matchesPattern(lowerMessage, ['总结', '摘要', '概括', '汇总']) &&
        this.matchesPattern(lowerMessage, ['新闻', '消息', '资讯', '动态'])) {
      const symbols = this.extractSymbols(message);
      return { type: 'news_summary', confidence: 0.8, entities: { symbols } };
    }

    if (this.matchesPattern(lowerMessage, ['总结', '摘要', '概括', '分析']) &&
        this.matchesPattern(lowerMessage, ['板块', '行业', '领域'])) {
      const sectorName = this.extractSectorName(message);
      return { type: 'sector_summary', confidence: sectorName ? 0.85 : 0.6, entities: { sectorName } };
    }

    const symbols = this.extractSymbols(message);
    if (symbols.length > 0 &&
        this.matchesPattern(lowerMessage, ['怎么样', '如何', '情况', '分析', '介绍', '查询', '看看'])) {
      return { type: 'stock_info', confidence: 0.75, entities: { symbols } };
    }

    if (this.matchesPattern(lowerMessage, ['什么', '为什么', '怎么', '如何', '是否', '能否', '可以'])) {
      return { type: 'general_question', confidence: 0.5, entities: { query: message } };
    }

    return { type: 'unknown', confidence: 0.3, entities: { query: message } };
  }

  async processMessage(userId: string, message: string): Promise<AIResponse> {
    try {
      const intent = this.parseIntent(message);
      let response: AIResponse;

      switch (intent.type) {
        case 'add_watchlist':
          response = await this.handleAddWatchlist(userId, intent);
          break;
        case 'remove_watchlist':
          response = await this.handleRemoveWatchlist(userId, intent);
          break;
        case 'stock_info':
          response = await this.handleStockInfo(intent);
          break;
        case 'stock_compare':
          response = await this.handleStockCompare(intent);
          break;
        case 'news_summary':
          response = await this.handleNewsSummary(intent);
          break;
        case 'sector_summary':
          response = await this.handleSectorSummary(intent);
          break;
        case 'general_question':
          response = await this.handleGeneralQuestion(userId, intent);
          break;
        default:
          response = {
            message: '抱歉，我没有理解您的意思。您可以尝试：\n- 添加/移除自选股\n- 查询股票信息\n- 对比两只股票\n- 总结新闻动态\n- 分析板块走势',
            intent,
            suggestions: ['添加AAPL到自选', '分析TSLA', '对比AAPL和MSFT', '总结科技板块新闻'],
          };
      }

      await this.saveMessage(userId, message, response);
      return response;
    } catch (error) {
      logger.error('处理AI消息失败:', error);
      throw error;
    }
  }


  private async handleAddWatchlist(userId: string, intent: ParsedIntent): Promise<AIResponse> {
    const symbols = intent.entities.symbols || [];
    
    if (symbols.length === 0) {
      return {
        message: '请告诉我您想添加哪只股票到自选？例如：添加AAPL到自选',
        intent,
        suggestions: ['添加AAPL到自选', '添加TSLA到自选', '添加MSFT到自选'],
      };
    }

    const results: string[] = [];
    const errors: string[] = [];

    for (const symbol of symbols) {
      try {
        await watchlistService.addStock(userId, symbol.toUpperCase());
        results.push(symbol.toUpperCase());
      } catch (error) {
        if ((error as Error).message.includes('已在')) {
          errors.push(`${symbol.toUpperCase()} 已在自选列表中`);
        } else {
          errors.push(`添加 ${symbol.toUpperCase()} 失败`);
        }
      }
    }

    let message = '';
    if (results.length > 0) message += `已成功添加 ${results.join(', ')} 到自选列表。`;
    if (errors.length > 0) message += errors.join('；');

    return { message, intent, actionTaken: 'add_watchlist', actionResult: { added: results, errors } };
  }

  private async handleRemoveWatchlist(userId: string, intent: ParsedIntent): Promise<AIResponse> {
    const symbols = intent.entities.symbols || [];
    
    if (symbols.length === 0) {
      return {
        message: '请告诉我您想移除哪只股票？例如：从自选移除AAPL',
        intent,
        suggestions: ['移除AAPL', '从自选删除TSLA'],
      };
    }

    const results: string[] = [];
    const errors: string[] = [];

    for (const symbol of symbols) {
      try {
        await watchlistService.removeStock(userId, symbol.toUpperCase());
        results.push(symbol.toUpperCase());
      } catch {
        errors.push(`移除 ${symbol.toUpperCase()} 失败`);
      }
    }

    let message = '';
    if (results.length > 0) message += `已从自选列表移除 ${results.join(', ')}。`;
    if (errors.length > 0) message += errors.join('；');

    return { message, intent, actionTaken: 'remove_watchlist', actionResult: { removed: results, errors } };
  }

  private async handleStockInfo(intent: ParsedIntent): Promise<AIResponse> {
    const symbols = intent.entities.symbols || [];
    
    if (symbols.length === 0) {
      return {
        message: '请告诉我您想查询哪只股票？',
        intent,
        suggestions: ['分析AAPL', '查看TSLA情况', 'MSFT怎么样'],
      };
    }

    const symbol = symbols[0].toUpperCase();
    
    try {
      const stockDetail = await stockService.getStockDetail(symbol);
      
      if (!stockDetail) {
        return { message: `未找到股票 ${symbol} 的信息。请检查股票代码是否正确。`, intent };
      }
      
      return {
        message: `**${stockDetail.name} (${symbol})**\n\n市值: ${this.formatMarketCap(stockDetail.marketCap)}\n行业: ${stockDetail.sector || 'N/A'}\n交易所: ${stockDetail.exchange || 'N/A'}`,
        intent,
        actionResult: { stockDetail },
        suggestions: [`对比${symbol}和其他股票`, `查看${symbol}新闻`, `添加${symbol}到自选`],
      };
    } catch (error) {
      logger.error(`获取股票信息失败 (${symbol}):`, error);
      return { message: `获取 ${symbol} 信息时出错，请稍后重试。`, intent };
    }
  }

  private async handleStockCompare(intent: ParsedIntent): Promise<AIResponse> {
    const symbols = intent.entities.symbols || [];
    
    if (symbols.length < 2) {
      return {
        message: '请提供至少两只股票进行对比。例如：对比AAPL和MSFT',
        intent,
        suggestions: ['对比AAPL和MSFT', '比较TSLA和RIVN', 'GOOGL vs META'],
      };
    }

    try {
      const comparison = await analysisService.compareStocks(symbols.slice(0, 2).map(s => s.toUpperCase()));
      return {
        message: comparison.summary + '\n\n' + comparison.recommendation,
        intent,
        actionTaken: 'stock_compare',
        actionResult: { symbols: symbols.slice(0, 2), comparison },
      };
    } catch (error) {
      logger.error('股票对比失败:', error);
      return { message: '对比分析时出错，请稍后重试。', intent };
    }
  }


  private async handleNewsSummary(intent: ParsedIntent): Promise<AIResponse> {
    const symbols = intent.entities.symbols || [];
    
    try {
      const news = await newsService.getLatestNews({ page: 1, limit: 10 });

      if (!news || news.length === 0) {
        return {
          message: symbols.length > 0 ? `暂无 ${symbols[0].toUpperCase()} 相关新闻。` : '暂无最新新闻。',
          intent,
        };
      }

      const summary = await analysisService.summarizeNews(news.map(n => n.title));

      return {
        message: `**新闻摘要**\n\n${summary}`,
        intent,
        actionTaken: 'news_summary',
        actionResult: { newsCount: news.length },
      };
    } catch (error) {
      logger.error('新闻摘要失败:', error);
      return { message: '生成新闻摘要时出错，请稍后重试。', intent };
    }
  }

  private async handleSectorSummary(intent: ParsedIntent): Promise<AIResponse> {
    const sectorName = intent.entities.sectorName;
    
    if (!sectorName) {
      return {
        message: '请告诉我您想了解哪个板块？例如：分析科技板块',
        intent,
        suggestions: ['分析科技板块', '医疗板块走势', '金融板块动态'],
      };
    }

    try {
      const sector = await prisma.sector.findFirst({
        where: {
          OR: [
            { name: { contains: sectorName, mode: 'insensitive' } },
            { nameZh: { contains: sectorName } },
          ],
        },
      });

      if (!sector) {
        return { message: `未找到 "${sectorName}" 板块。可用板块包括：科技、医疗保健、金融、能源等。`, intent };
      }

      const stocks = await prisma.stock.findMany({
        where: { sector: sector.name },
        include: { quotes: { orderBy: { timestamp: 'desc' }, take: 1 } },
        take: 10,
      });

      const avgChange = stocks.reduce((sum, s) => sum + (s.quotes[0]?.changePercent || 0), 0) / stocks.length;

      return {
        message: `**${sector.nameZh}板块分析**\n\n板块平均涨跌幅: ${avgChange.toFixed(2)}%\n板块股票数量: ${sector.stockCount}\n\n主要成分股表现:\n` +
          stocks.slice(0, 5).map(s => `- ${s.symbol}: ${s.quotes[0]?.changePercent?.toFixed(2) || 'N/A'}%`).join('\n'),
        intent,
        actionTaken: 'sector_summary',
        actionResult: { sector: sector.nameZh, avgChange },
      };
    } catch (error) {
      logger.error('板块摘要失败:', error);
      return { message: '生成板块摘要时出错，请稍后重试。', intent };
    }
  }

  private async handleGeneralQuestion(userId: string, intent: ParsedIntent): Promise<AIResponse> {
    const query = intent.entities.query || '';
    
    try {
      const response = await analysisService.chat(userId, query, {});
      return { message: response.message, intent };
    } catch (error) {
      logger.error('处理一般问题失败:', error);
      return {
        message: '抱歉，我暂时无法回答这个问题。您可以尝试询问股票相关的问题。',
        intent,
        suggestions: ['分析AAPL', '对比TSLA和RIVN', '总结今日新闻'],
      };
    }
  }

  async getPersonalizedSuggestions(userId: string): Promise<string[]> {
    try {
      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      const watchlist = await prisma.watchlistItem.findMany({ where: { userId }, take: 5 });

      const suggestions: string[] = [];

      if (watchlist.length > 0) {
        const symbol = watchlist[0].symbol;
        suggestions.push(`查看${symbol}最新动态`);
        suggestions.push(`分析${symbol}技术指标`);
      }

      if (settings?.investmentPreferences?.length) {
        const pref = settings.investmentPreferences[0];
        suggestions.push(`了解${pref}相关股票`);
      }

      suggestions.push('总结今日市场新闻');
      suggestions.push('查看热门板块');

      return suggestions.slice(0, 5);
    } catch (error) {
      logger.error('获取个性化建议失败:', error);
      return ['分析AAPL', '总结今日新闻', '查看热门板块'];
    }
  }


  private async saveMessage(userId: string, userMessage: string, response: AIResponse): Promise<void> {
    try {
      const key = `ai:conversation:${userId}`;
      if (this.redis.status !== 'ready') return;

      const existingData = await this.redis.get(key);
      const messages: AIMessage[] = existingData ? JSON.parse(existingData) : [];

      messages.push({ role: 'user', content: userMessage, timestamp: new Date() });
      messages.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        metadata: { intent: response.intent, actionTaken: response.actionTaken, actionResult: response.actionResult },
      });

      const recentMessages = messages.slice(-20);
      await this.redis.setex(key, this.CONVERSATION_TTL, JSON.stringify(recentMessages));
    } catch (error) {
      logger.error('保存对话消息失败:', error);
    }
  }

  async getConversationHistory(userId: string): Promise<AIMessage[]> {
    try {
      if (this.redis.status !== 'ready') return [];
      const key = `ai:conversation:${userId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('获取对话历史失败:', error);
      return [];
    }
  }

  async clearConversationHistory(userId: string): Promise<void> {
    try {
      if (this.redis.status !== 'ready') return;
      const key = `ai:conversation:${userId}`;
      await this.redis.del(key);
    } catch (error) {
      logger.error('清除对话历史失败:', error);
    }
  }

  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(p => text.includes(p));
  }

  private extractSymbols(text: string): string[] {
    const matches = text.match(/\b[A-Za-z]{1,5}\b/g) || [];
    const commonWords = ['the', 'and', 'for', 'to', 'of', 'in', 'is', 'it', 'vs', 'or'];
    return matches.filter(m => !commonWords.includes(m.toLowerCase()));
  }

  private extractSectorName(text: string): string | undefined {
    const sectorKeywords = ['科技', '医疗', '金融', '能源', '工业', '消费', '房地产', '公用事业', '通信',
      'technology', 'healthcare', 'financial', 'energy', 'industrial', 'consumer'];
    for (const keyword of sectorKeywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) return keyword;
    }
    return undefined;
  }

  private formatMarketCap(value: bigint | number | null | undefined): string {
    if (!value) return 'N/A';
    const num = typeof value === 'bigint' ? Number(value) : value;
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  }
}

export const aiAssistantService = new AIAssistantService();
