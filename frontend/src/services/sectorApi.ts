import api from './api';

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
  publishedAt: string;
  symbols: string[];
}

export interface SectorStock {
  symbol: string;
  name: string;
  marketCap: number | null;
  changePercent?: number;
}

export interface SectorPerformance {
  sectorId: string;
  name: string;
  nameZh: string;
  changePercent: number;
  topGainers: { symbol: string; name: string; changePercent: number }[];
  topLosers: { symbol: string; name: string; changePercent: number }[];
}

/**
 * 获取所有板块列表
 */
export async function getAllSectors(): Promise<SectorInfo[]> {
  const response = await api.get<{ sectors: SectorInfo[] }>('/sectors');
  return response.data.sectors;
}

/**
 * 获取板块详情
 */
export async function getSectorById(sectorId: string): Promise<SectorInfo> {
  const response = await api.get<{ sector: SectorInfo }>(`/sectors/${sectorId}`);
  return response.data.sector;
}

/**
 * 获取用户订阅的板块列表
 */
export async function getUserSubscriptions(): Promise<SectorInfo[]> {
  const response = await api.get<{ subscriptions: SectorInfo[] }>('/sectors/subscriptions');
  return response.data.subscriptions;
}

/**
 * 订阅板块
 */
export async function subscribeSector(sectorId: string): Promise<void> {
  await api.post(`/sectors/${sectorId}/subscribe`);
}

/**
 * 取消订阅板块
 */
export async function unsubscribeSector(sectorId: string): Promise<void> {
  await api.delete(`/sectors/${sectorId}/subscribe`);
}

/**
 * 获取板块内的股票列表
 */
export async function getSectorStocks(
  sectorId: string,
  options?: { limit?: number; sortBy?: 'marketCap' | 'changePercent' }
): Promise<SectorStock[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.sortBy) params.append('sortBy', options.sortBy);

  const response = await api.get<{ stocks: SectorStock[] }>(
    `/sectors/${sectorId}/stocks?${params.toString()}`
  );
  return response.data.stocks;
}

/**
 * 获取板块相关新闻
 */
export async function getSectorNews(sectorId: string, limit?: number): Promise<SectorNews[]> {
  const params = limit ? `?limit=${limit}` : '';
  const response = await api.get<{ news: SectorNews[] }>(`/sectors/${sectorId}/news${params}`);
  return response.data.news;
}

/**
 * 获取板块表现数据
 */
export async function getSectorPerformance(sectorId: string): Promise<SectorPerformance> {
  const response = await api.get<{ performance: SectorPerformance }>(
    `/sectors/${sectorId}/performance`
  );
  return response.data.performance;
}
