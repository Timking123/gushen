/**
 * Portfolio Page Component
 * Displays portfolio holdings, performance, and analytics
 * Requirements: 17.1, 17.2, 17.3, 17.5, 17.6
 */

import { useState, useEffect, useCallback } from 'react'
import portfolioApi from '../services/portfolioApi'
import type {
  Portfolio,
  PortfolioSummary,
  SectorDistribution,
  ReturnsCurveResult,
  BenchmarkComparisonResult,
  BenchmarkInfo,
  ReturnsTimeRange,
  PortfolioTransaction,
} from '../services/portfolioApi'
import './PortfolioPage.css'

interface PortfolioPageProps {
  portfolioId?: string
}

export function PortfolioPage({ portfolioId: propPortfolioId }: PortfolioPageProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    propPortfolioId || null
  )
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [sectorDistribution, setSectorDistribution] = useState<SectorDistribution[]>([])
  const [returnsCurve, setReturnsCurve] = useState<ReturnsCurveResult | null>(null)
  const [benchmarkComparison, setBenchmarkComparison] = useState<BenchmarkComparisonResult | null>(
    null
  )
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [availableBenchmarks, setAvailableBenchmarks] = useState<BenchmarkInfo[]>([])
  const [selectedBenchmark, setSelectedBenchmark] = useState('SPY')
  const [selectedRange, setSelectedRange] = useState<ReturnsTimeRange>('1Y')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'holdings' | 'performance' | 'transactions'>(
    'holdings'
  )

  // Create portfolio modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [newPortfolioDescription, setNewPortfolioDescription] = useState('')

  // Load portfolios
  useEffect(() => {
    const loadPortfolios = async () => {
      try {
        const data = await portfolioApi.getPortfolios()
        setPortfolios(data)
        if (data.length > 0 && !selectedPortfolioId) {
          setSelectedPortfolioId(data[0].id)
        }
      } catch (err) {
        setError('Failed to load portfolios')
        console.error(err)
      }
    }
    loadPortfolios()
  }, [selectedPortfolioId])

  // Load available benchmarks
  useEffect(() => {
    const loadBenchmarks = async () => {
      try {
        const data = await portfolioApi.getAvailableBenchmarks()
        setAvailableBenchmarks(data)
      } catch (err) {
        console.error('Failed to load benchmarks:', err)
      }
    }
    loadBenchmarks()
  }, [])

  // Load portfolio data
  const loadPortfolioData = useCallback(async () => {
    if (!selectedPortfolioId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [summaryData, sectorData, transactionsData] = await Promise.all([
        portfolioApi.getPortfolioSummary(selectedPortfolioId),
        portfolioApi.getSectorDistribution(selectedPortfolioId),
        portfolioApi.getTransactions(selectedPortfolioId, { limit: 20 }),
      ])

      setSummary(summaryData)
      setSectorDistribution(sectorData)
      setTransactions(transactionsData)

      // Load performance data
      try {
        const [returnsData, comparisonData] = await Promise.all([
          portfolioApi.getReturnsCurve(selectedPortfolioId, selectedRange),
          portfolioApi.getBenchmarkComparison(selectedPortfolioId, selectedBenchmark, selectedRange),
        ])
        setReturnsCurve(returnsData)
        setBenchmarkComparison(comparisonData)
      } catch {
        // Performance data may not be available for new portfolios
        setReturnsCurve(null)
        setBenchmarkComparison(null)
      }
    } catch (err) {
      setError('Failed to load portfolio data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedPortfolioId, selectedRange, selectedBenchmark])

  useEffect(() => {
    loadPortfolioData()
  }, [loadPortfolioData])

  // Create portfolio handler
  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim()) return

    try {
      const newPortfolio = await portfolioApi.createPortfolio({
        name: newPortfolioName,
        description: newPortfolioDescription || undefined,
      })
      setPortfolios([...portfolios, newPortfolio])
      setSelectedPortfolioId(newPortfolio.id)
      setShowCreateModal(false)
      setNewPortfolioName('')
      setNewPortfolioDescription('')
    } catch (err) {
      console.error('Failed to create portfolio:', err)
    }
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  // Format percentage
  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const timeRanges: ReturnsTimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']

  if (loading && portfolios.length === 0) {
    return (
      <div className="portfolio-page">
        <div className="loading">Loading portfolios...</div>
      </div>
    )
  }

  return (
    <div className="portfolio-page">
      <header className="portfolio-header">
        <h1>Portfolio</h1>
        <div className="portfolio-selector">
          <select
            value={selectedPortfolioId || ''}
            onChange={(e) => setSelectedPortfolioId(e.target.value)}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn-create" onClick={() => setShowCreateModal(true)}>
            + New Portfolio
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {portfolios.length === 0 ? (
        <div className="empty-state">
          <h2>No Portfolios Yet</h2>
          <p>Create your first portfolio to start tracking your investments.</p>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Portfolio
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="summary-cards">
              <div className="summary-card">
                <span className="label">Total Value</span>
                <span className="value">{formatCurrency(summary.totalMarketValue)}</span>
              </div>
              <div className="summary-card">
                <span className="label">Total Gain/Loss</span>
                <span className={`value ${summary.totalGain >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(summary.totalGain)} ({formatPercent(summary.totalGainPercent)})
                </span>
              </div>
              <div className="summary-card">
                <span className="label">Day Change</span>
                <span className={`value ${summary.dayChange >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(summary.dayChange)} ({formatPercent(summary.dayChangePercent)})
                </span>
              </div>
              <div className="summary-card">
                <span className="label">Cost Basis</span>
                <span className="value">{formatCurrency(summary.totalCostBasis)}</span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'holdings' ? 'active' : ''}`}
              onClick={() => setActiveTab('holdings')}
            >
              Holdings
            </button>
            <button
              className={`tab ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              Performance
            </button>
            <button
              className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              Transactions
            </button>
          </div>

          {/* Holdings Tab */}
          {activeTab === 'holdings' && summary && (
            <div className="holdings-section">
              <div className="holdings-table-container">
                <table className="holdings-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Shares</th>
                      <th>Price</th>
                      <th>Market Value</th>
                      <th>Cost Basis</th>
                      <th>Gain/Loss</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.holdings.map((holding) => (
                      <tr key={holding.symbol}>
                        <td className="symbol">{holding.symbol}</td>
                        <td>{holding.shares.toFixed(2)}</td>
                        <td>{formatCurrency(holding.currentPrice)}</td>
                        <td>{formatCurrency(holding.marketValue)}</td>
                        <td>{formatCurrency(holding.costBasis)}</td>
                        <td className={holding.gain >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(holding.gain)} ({formatPercent(holding.gainPercent)})
                        </td>
                        <td>{holding.weight.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sector Distribution */}
              {sectorDistribution.length > 0 && (
                <div className="sector-distribution">
                  <h3>Sector Distribution</h3>
                  <div className="sector-bars">
                    {sectorDistribution.map((sector) => (
                      <div key={sector.sector} className="sector-bar-item">
                        <div className="sector-info">
                          <span className="sector-name">{sector.sector}</span>
                          <span className="sector-weight">{sector.weight.toFixed(1)}%</span>
                        </div>
                        <div className="sector-bar">
                          <div
                            className="sector-bar-fill"
                            style={{ width: `${sector.weight}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="performance-section">
              <div className="performance-controls">
                <div className="time-range-selector">
                  {timeRanges.map((range) => (
                    <button
                      key={range}
                      className={`range-btn ${selectedRange === range ? 'active' : ''}`}
                      onClick={() => setSelectedRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <div className="benchmark-selector">
                  <label>Benchmark:</label>
                  <select
                    value={selectedBenchmark}
                    onChange={(e) => setSelectedBenchmark(e.target.value)}
                  >
                    {availableBenchmarks.map((b) => (
                      <option key={b.symbol} value={b.symbol}>
                        {b.name} ({b.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {returnsCurve && (
                <div className="returns-summary">
                  <div className="returns-stat">
                    <span className="label">Total Return</span>
                    <span
                      className={`value ${returnsCurve.totalReturn >= 0 ? 'positive' : 'negative'}`}
                    >
                      {formatPercent(returnsCurve.totalReturn)}
                    </span>
                  </div>
                  <div className="returns-stat">
                    <span className="label">Annualized Return</span>
                    <span
                      className={`value ${returnsCurve.annualizedReturn >= 0 ? 'positive' : 'negative'}`}
                    >
                      {formatPercent(returnsCurve.annualizedReturn)}
                    </span>
                  </div>
                  <div className="returns-stat">
                    <span className="label">Max Drawdown</span>
                    <span className="value negative">-{returnsCurve.maxDrawdown.toFixed(2)}%</span>
                  </div>
                </div>
              )}

              {benchmarkComparison && (
                <div className="benchmark-comparison">
                  <h3>vs {selectedBenchmark}</h3>
                  <div className="comparison-stats">
                    <div className="comparison-stat">
                      <span className="label">Portfolio</span>
                      <span
                        className={`value ${benchmarkComparison.portfolioTotalReturn >= 0 ? 'positive' : 'negative'}`}
                      >
                        {formatPercent(benchmarkComparison.portfolioTotalReturn)}
                      </span>
                    </div>
                    <div className="comparison-stat">
                      <span className="label">{selectedBenchmark}</span>
                      <span
                        className={`value ${benchmarkComparison.benchmarkTotalReturn >= 0 ? 'positive' : 'negative'}`}
                      >
                        {formatPercent(benchmarkComparison.benchmarkTotalReturn)}
                      </span>
                    </div>
                    <div className="comparison-stat">
                      <span className="label">Alpha</span>
                      <span
                        className={`value ${benchmarkComparison.alpha >= 0 ? 'positive' : 'negative'}`}
                      >
                        {formatPercent(benchmarkComparison.alpha)}
                      </span>
                    </div>
                  </div>

                  {/* Simple chart representation */}
                  <div className="returns-chart">
                    <div className="chart-legend">
                      <span className="legend-item portfolio">Portfolio</span>
                      <span className="legend-item benchmark">{selectedBenchmark}</span>
                    </div>
                    <div className="chart-area">
                      {benchmarkComparison.dataPoints.length > 0 ? (
                        <div className="chart-placeholder">
                          <p>
                            Returns from {formatDate(benchmarkComparison.startDate)} to{' '}
                            {formatDate(benchmarkComparison.endDate)}
                          </p>
                          <p>{benchmarkComparison.dataPoints.length} data points</p>
                        </div>
                      ) : (
                        <p>No data available for the selected period</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!returnsCurve && !benchmarkComparison && (
                <div className="no-performance-data">
                  <p>
                    Performance data is not available. Add transactions to your portfolio to see
                    performance metrics.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="transactions-section">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Symbol</th>
                    <th>Shares</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className={`tx-${tx.type}`}>
                      <td>{formatDate(tx.transactionDate)}</td>
                      <td className="tx-type">{tx.type.toUpperCase()}</td>
                      <td className="symbol">{tx.symbol}</td>
                      <td>{tx.shares.toFixed(2)}</td>
                      <td>{formatCurrency(tx.pricePerShare)}</td>
                      <td>{formatCurrency(tx.totalAmount)}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="no-data">
                        No transactions recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create Portfolio Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Portfolio</h2>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="My Portfolio"
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={newPortfolioDescription}
                onChange={(e) => setNewPortfolioDescription(e.target.value)}
                placeholder="Portfolio description..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreatePortfolio}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PortfolioPage
