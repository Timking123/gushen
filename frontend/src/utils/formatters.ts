/**
 * 数据格式化工具函数
 */

/**
 * Format market cap value to human-readable format
 * Implements Requirement 2.3: 显示公司市值（格式化为易读形式，如 1.5T、200B）
 *
 * Formatting rules:
 * - >= 1 trillion (1e12): Display as xT
 * - >= 1 billion (1e9): Display as xB
 * - >= 1 million (1e6): Display as xM
 * - < 1 million: Display original value with locale formatting
 *
 * @param marketCap - Market cap value in dollars
 * @returns Formatted string (e.g., "1.5T", "200B", "50M")
 */
export function formatMarketCap(marketCap: number | null | undefined): string {
  if (marketCap === null || marketCap === undefined) {
    return '暂无数据';
  }

  if (marketCap >= 1e12) {
    return `${(marketCap / 1e12).toFixed(2).replace(/\.?0+$/, '')}T`;
  }
  if (marketCap >= 1e9) {
    return `${(marketCap / 1e9).toFixed(2).replace(/\.?0+$/, '')}B`;
  }
  if (marketCap >= 1e6) {
    return `${(marketCap / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  return marketCap.toLocaleString();
}
