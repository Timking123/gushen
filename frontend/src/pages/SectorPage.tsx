import React, { useState, useEffect } from 'react';
import {
  getAllSectors,
  getSectorById,
  getSectorStocks,
  getSectorNews,
  getSectorPerformance,
  subscribeSector,
  unsubscribeSector,
  SectorInfo,
  SectorStock,
  SectorNews,
  SectorPerformance,
} from '../services/sectorApi';
import { useAuthStore } from '../stores/authStore';
import './SectorPage.css';

const SectorPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [sectors, setSectors] = useState<SectorInfo[]>([]);
  const [selectedSector, setSelectedSector] = useState<SectorInfo | null>(null);
  const [sectorStocks, setSectorStocks] = useState<SectorStock[]>([]);
  const [sectorNews, setSectorNews] = useState<SectorNews[]>([]);
  const [performance, setPerformance] = useState<SectorPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'marketCap' | 'changePercent'>('marketCap');

  // 加载板块列表
  useEffect(() => {
    const loadSectors = async () => {
      try {
        setLoading(true);
        const data = await getAllSectors();
        setSectors(data);
        if (data.length > 0 && !selectedSector) {
          setSelectedSector(data[0]);
        }
      } catch (err) {
        setError('加载板块列表失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSectors();
  }, []);

  // 加载选中板块的详情
  useEffect(() => {
    if (!selectedSector) return;

    const loadSectorDetails = async () => {
      try {
        const [stocks, news, perf] = await Promise.all([
          getSectorStocks(selectedSector.id, { limit: 20, sortBy }),
          getSectorNews(selectedSector.id, 10),
          getSectorPerformance(selectedSector.id),
        ]);
        setSectorStocks(stocks);
        setSectorNews(news);
        setPerformance(perf);
      } catch (err) {
        console.error('加载板块详情失败:', err);
      }
    };

    loadSectorDetails();
  }, [selectedSector, sortBy]);


  // 处理订阅/取消订阅
  const handleToggleSubscription = async (sector: SectorInfo) => {
    if (!isAuthenticated) {
      alert('请先登录');
      return;
    }

    try {
      if (sector.isSubscribed) {
        await unsubscribeSector(sector.id);
      } else {
        await subscribeSector(sector.id);
      }

      // 更新本地状态
      setSectors((prev) =>
        prev.map((s) =>
          s.id === sector.id ? { ...s, isSubscribed: !s.isSubscribed } : s
        )
      );

      if (selectedSector?.id === sector.id) {
        setSelectedSector((prev) =>
          prev ? { ...prev, isSubscribed: !prev.isSubscribed } : null
        );
      }
    } catch (err) {
      console.error('订阅操作失败:', err);
      alert('操作失败，请重试');
    }
  };

  // 格式化市值
  const formatMarketCap = (value: number | null): string => {
    if (!value) return '-';
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}万亿`;
    if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
    return value.toString();
  };

  // 格式化涨跌幅
  const formatChangePercent = (value: number | undefined): string => {
    if (value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // 获取涨跌幅颜色类名
  const getChangeClass = (value: number | undefined): string => {
    if (value === undefined) return '';
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return '';
  };

  if (loading) {
    return <div className="sector-page loading">加载中...</div>;
  }

  if (error) {
    return <div className="sector-page error">{error}</div>;
  }

  return (
    <div className="sector-page">
      {/* 板块列表侧边栏 */}
      <aside className="sector-sidebar">
        <h2>板块列表</h2>
        <ul className="sector-list">
          {sectors.map((sector) => (
            <li
              key={sector.id}
              className={`sector-item ${selectedSector?.id === sector.id ? 'active' : ''}`}
              onClick={() => setSelectedSector(sector)}
            >
              <div className="sector-item-info">
                <span className="sector-name">{sector.nameZh}</span>
                <span className="sector-count">{sector.stockCount} 只股票</span>
              </div>
              {isAuthenticated && (
                <button
                  className={`subscribe-btn ${sector.isSubscribed ? 'subscribed' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSubscription(sector);
                  }}
                >
                  {sector.isSubscribed ? '已订阅' : '订阅'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>


      {/* 板块详情主区域 */}
      <main className="sector-main">
        {selectedSector && (
          <>
            {/* 板块头部 */}
            <header className="sector-header">
              <div className="sector-title">
                <h1>{selectedSector.nameZh}</h1>
                <span className="sector-name-en">{selectedSector.name}</span>
              </div>
              {performance && (
                <div className={`sector-change ${getChangeClass(performance.changePercent)}`}>
                  {formatChangePercent(performance.changePercent)}
                </div>
              )}
            </header>

            {/* 板块表现 */}
            {performance && (
              <section className="sector-performance">
                <div className="performance-section">
                  <h3>涨幅榜</h3>
                  <ul className="performance-list gainers">
                    {performance.topGainers.map((stock) => (
                      <li key={stock.symbol}>
                        <span className="stock-symbol">{stock.symbol}</span>
                        <span className="stock-name">{stock.name}</span>
                        <span className={`stock-change ${getChangeClass(stock.changePercent)}`}>
                          {formatChangePercent(stock.changePercent)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="performance-section">
                  <h3>跌幅榜</h3>
                  <ul className="performance-list losers">
                    {performance.topLosers.map((stock) => (
                      <li key={stock.symbol}>
                        <span className="stock-symbol">{stock.symbol}</span>
                        <span className="stock-name">{stock.name}</span>
                        <span className={`stock-change ${getChangeClass(stock.changePercent)}`}>
                          {formatChangePercent(stock.changePercent)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* 板块股票列表 */}
            <section className="sector-stocks">
              <div className="section-header">
                <h3>板块股票</h3>
                <div className="sort-controls">
                  <label>排序：</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'marketCap' | 'changePercent')}
                  >
                    <option value="marketCap">市值</option>
                    <option value="changePercent">涨跌幅</option>
                  </select>
                </div>
              </div>
              <table className="stocks-table">
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th>市值</th>
                    <th>涨跌幅</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorStocks.map((stock) => (
                    <tr key={stock.symbol}>
                      <td className="stock-symbol">{stock.symbol}</td>
                      <td className="stock-name">{stock.name}</td>
                      <td>{formatMarketCap(stock.marketCap)}</td>
                      <td className={getChangeClass(stock.changePercent)}>
                        {formatChangePercent(stock.changePercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* 板块新闻 */}
            <section className="sector-news">
              <h3>板块新闻</h3>
              <ul className="news-list">
                {sectorNews.map((news) => (
                  <li key={news.id} className="news-item">
                    <div className="news-title">{news.title}</div>
                    {news.summary && <div className="news-summary">{news.summary}</div>}
                    <div className="news-meta">
                      <span className="news-source">{news.source}</span>
                      <span className="news-time">
                        {new Date(news.publishedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </li>
                ))}
                {sectorNews.length === 0 && (
                  <li className="no-news">暂无相关新闻</li>
                )}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default SectorPage;
