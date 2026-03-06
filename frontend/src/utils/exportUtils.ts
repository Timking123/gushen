/**
 * 数据导出工具函数
 */

export interface ExportOptions {
  filename: string;
  format: 'csv' | 'json';
}

/**
 * 将数据导出为 CSV 格式
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // 获取所有列名
  const headers = Object.keys(data[0]);

  // 构建 CSV 内容
  const csvContent = [
    // 表头
    headers.join(','),
    // 数据行
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // 处理包含逗号或引号的值
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        })
        .join(',')
    ),
  ].join('\n');

  // 添加 BOM 以支持中文
  const BOM = '\uFEFF';
  downloadFile(BOM + csvContent, `${options.filename}.csv`, 'text/csv;charset=utf-8');
}

/**
 * 将数据导出为 JSON 格式
 */
export function exportToJSON<T>(data: T, options: ExportOptions): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${options.filename}.json`, 'application/json');
}

/**
 * 下载文件
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * 导出自选股列表
 */
export interface WatchlistExportItem {
  symbol: string;
  name: string;
  addedAt: string;
  notes?: string;
}

export function exportWatchlist(
  items: WatchlistExportItem[],
  format: 'csv' | 'json' = 'csv'
): void {
  const filename = `watchlist_${formatDate(new Date())}`;

  if (format === 'csv') {
    exportToCSV(items, { filename, format: 'csv' });
  } else {
    exportToJSON(items, { filename, format: 'json' });
  }
}

/**
 * 导出投资组合数据
 */
export interface PortfolioExportData {
  name: string;
  holdings: {
    symbol: string;
    name: string;
    shares: number;
    avgCostBasis: number;
    currentPrice?: number;
    marketValue?: number;
    profit?: number;
    profitPercent?: number;
  }[];
  summary: {
    totalValue: number;
    totalCost: number;
    totalProfit: number;
    totalProfitPercent: number;
  };
  exportedAt: string;
}

export function exportPortfolio(
  data: PortfolioExportData,
  format: 'csv' | 'json' = 'csv'
): void {
  const filename = `portfolio_${data.name}_${formatDate(new Date())}`;

  if (format === 'csv') {
    // 导出持仓明细
    const csvData = data.holdings.map((h) => ({
      股票代码: h.symbol,
      股票名称: h.name,
      持仓数量: h.shares,
      成本价: h.avgCostBasis.toFixed(2),
      现价: h.currentPrice?.toFixed(2) || '-',
      市值: h.marketValue?.toFixed(2) || '-',
      盈亏: h.profit?.toFixed(2) || '-',
      盈亏比例: h.profitPercent ? `${h.profitPercent.toFixed(2)}%` : '-',
    }));

    exportToCSV(csvData, { filename, format: 'csv' });
  } else {
    exportToJSON(data, { filename, format: 'json' });
  }
}

/**
 * 导出交易记录
 */
export interface TransactionExportItem {
  date: string;
  symbol: string;
  type: 'buy' | 'sell' | 'dividend';
  shares: number;
  pricePerShare: number;
  totalAmount: number;
  notes?: string;
}

export function exportTransactions(
  transactions: TransactionExportItem[],
  format: 'csv' | 'json' = 'csv'
): void {
  const filename = `transactions_${formatDate(new Date())}`;

  if (format === 'csv') {
    const csvData = transactions.map((t) => ({
      日期: t.date,
      股票代码: t.symbol,
      交易类型: t.type === 'buy' ? '买入' : t.type === 'sell' ? '卖出' : '股息',
      数量: t.shares,
      单价: t.pricePerShare.toFixed(2),
      总金额: t.totalAmount.toFixed(2),
      备注: t.notes || '',
    }));

    exportToCSV(csvData, { filename, format: 'csv' });
  } else {
    exportToJSON(transactions, { filename, format: 'json' });
  }
}

/**
 * 格式化日期为文件名友好格式
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}
