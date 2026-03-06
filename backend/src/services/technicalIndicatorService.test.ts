import { TechnicalIndicatorService } from './technicalIndicatorService.js';
import type { OHLCV } from './stockService.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/redis', () => ({
  redisHelpers: {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TechnicalIndicatorService', () => {
  let service: TechnicalIndicatorService;

  beforeEach(() => {
    service = new TechnicalIndicatorService();
    jest.clearAllMocks();
  });

  describe('calculateSMA', () => {
    it('should calculate SMA correctly for valid data', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const sma5 = service.calculateSMA(prices, 5);
      
      // SMA of last 5 values: (16 + 17 + 18 + 19 + 20) / 5 = 18
      expect(sma5).toBe(18);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 11, 12];
      const sma5 = service.calculateSMA(prices, 5);
      
      expect(sma5).toBeNull();
    });

    it('should return null for invalid period', () => {
      const prices = [10, 11, 12, 13, 14];
      
      expect(service.calculateSMA(prices, 0)).toBeNull();
      expect(service.calculateSMA(prices, -1)).toBeNull();
    });

    it('should handle single value period', () => {
      const prices = [10, 20, 30];
      const sma1 = service.calculateSMA(prices, 1);
      
      expect(sma1).toBe(30);
    });
  });

  describe('calculateEMA', () => {
    it('should calculate EMA correctly for valid data', () => {
      const prices = [22, 22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15, 22.39, 22.38, 22.61];
      const ema10 = service.calculateEMA(prices, 10);
      
      expect(ema10).not.toBeNull();
      expect(typeof ema10).toBe('number');
      // EMA should be close to recent prices
      expect(ema10!).toBeGreaterThan(22);
      expect(ema10!).toBeLessThan(23);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 11, 12];
      const ema5 = service.calculateEMA(prices, 5);
      
      expect(ema5).toBeNull();
    });

    it('should return null for invalid period', () => {
      const prices = [10, 11, 12, 13, 14];
      
      expect(service.calculateEMA(prices, 0)).toBeNull();
      expect(service.calculateEMA(prices, -1)).toBeNull();
    });

    it('should give more weight to recent prices than SMA', () => {
      // Prices trending up sharply at the end - need more data points after initial period
      const prices = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 15, 20, 25, 30];
      const sma = service.calculateSMA(prices, 10);
      const ema = service.calculateEMA(prices, 10);
      
      // EMA should be higher than SMA due to recent price spike
      // SMA of last 10: (10+10+10+10+15+20+25+30) / 10 = 15.5 (approx)
      // EMA gives more weight to recent higher prices
      expect(ema!).toBeGreaterThan(sma!);
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI correctly for valid data', () => {
      // Simulated price data with some ups and downs
      const prices = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
                      45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
      const rsi = service.calculateRSI(prices, 14);
      
      expect(rsi).not.toBeNull();
      expect(rsi!).toBeGreaterThanOrEqual(0);
      expect(rsi!).toBeLessThanOrEqual(100);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 11, 12, 13, 14];
      const rsi = service.calculateRSI(prices, 14);
      
      expect(rsi).toBeNull();
    });

    it('should return 100 when all gains and no losses', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
      const rsi = service.calculateRSI(prices, 14);
      
      expect(rsi).toBe(100);
    });

    it('should return 0 when all losses and no gains', () => {
      const prices = [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
      const rsi = service.calculateRSI(prices, 14);
      
      expect(rsi).toBe(0);
    });

    it('should return 50 when no price changes', () => {
      const prices = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      const rsi = service.calculateRSI(prices, 14);
      
      expect(rsi).toBe(50);
    });
  });

  describe('calculateMACD', () => {
    it('should calculate MACD correctly for valid data', () => {
      // Generate enough price data for MACD calculation
      const prices: number[] = [];
      for (let i = 0; i < 50; i++) {
        prices.push(100 + Math.sin(i / 5) * 10 + i * 0.1);
      }
      
      const macd = service.calculateMACD(prices, 12, 26, 9);
      
      expect(macd).not.toBeNull();
      expect(macd!.value).toBeDefined();
      expect(macd!.signal).toBeDefined();
      expect(macd!.histogram).toBeDefined();
      expect(macd!.histogram).toBeCloseTo(macd!.value - macd!.signal, 10);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const macd = service.calculateMACD(prices, 12, 26, 9);
      
      expect(macd).toBeNull();
    });

    it('should have positive MACD when fast EMA > slow EMA', () => {
      // Strongly uptrending prices
      const prices: number[] = [];
      for (let i = 0; i < 50; i++) {
        prices.push(100 + i * 2);
      }
      
      const macd = service.calculateMACD(prices, 12, 26, 9);
      
      expect(macd).not.toBeNull();
      expect(macd!.value).toBeGreaterThan(0);
    });
  });

  describe('calculateBollingerBands', () => {
    it('should calculate Bollinger Bands correctly for valid data', () => {
      const prices = [20, 21, 22, 21, 20, 21, 22, 23, 22, 21, 20, 21, 22, 21, 20, 21, 22, 23, 22, 21];
      const bb = service.calculateBollingerBands(prices, 20, 2);
      
      expect(bb).not.toBeNull();
      expect(bb!.upper).toBeGreaterThan(bb!.middle);
      expect(bb!.middle).toBeGreaterThan(bb!.lower);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 11, 12, 13, 14];
      const bb = service.calculateBollingerBands(prices, 20, 2);
      
      expect(bb).toBeNull();
    });

    it('should have middle band equal to SMA', () => {
      const prices = [20, 21, 22, 21, 20, 21, 22, 23, 22, 21, 20, 21, 22, 21, 20, 21, 22, 23, 22, 21];
      const bb = service.calculateBollingerBands(prices, 20, 2);
      const sma = service.calculateSMA(prices, 20);
      
      expect(bb!.middle).toBe(sma);
    });

    it('should have symmetric bands around middle', () => {
      const prices = [20, 21, 22, 21, 20, 21, 22, 23, 22, 21, 20, 21, 22, 21, 20, 21, 22, 23, 22, 21];
      const bb = service.calculateBollingerBands(prices, 20, 2);
      
      const upperDiff = bb!.upper - bb!.middle;
      const lowerDiff = bb!.middle - bb!.lower;
      
      expect(upperDiff).toBeCloseTo(lowerDiff, 10);
    });
  });

  describe('calculateATR', () => {
    it('should calculate ATR correctly for valid data', () => {
      const ohlcvData: OHLCV[] = generateOHLCVData(20);
      const atr = service.calculateATR(ohlcvData, 14);
      
      expect(atr).not.toBeNull();
      expect(atr!).toBeGreaterThan(0);
    });

    it('should return null for insufficient data', () => {
      const ohlcvData: OHLCV[] = generateOHLCVData(10);
      const atr = service.calculateATR(ohlcvData, 14);
      
      expect(atr).toBeNull();
    });

    it('should return higher ATR for more volatile data', () => {
      // Low volatility data
      const lowVolData: OHLCV[] = [];
      for (let i = 0; i < 20; i++) {
        lowVolData.push({
          timestamp: new Date(2024, 0, i + 1),
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000000,
        });
      }
      
      // High volatility data
      const highVolData: OHLCV[] = [];
      for (let i = 0; i < 20; i++) {
        highVolData.push({
          timestamp: new Date(2024, 0, i + 1),
          open: 100,
          high: 110,
          low: 90,
          close: 100,
          volume: 1000000,
        });
      }
      
      const lowATR = service.calculateATR(lowVolData, 14);
      const highATR = service.calculateATR(highVolData, 14);
      
      expect(highATR!).toBeGreaterThan(lowATR!);
    });
  });

  describe('calculateADX', () => {
    it('should calculate ADX correctly for valid data', () => {
      const ohlcvData: OHLCV[] = generateTrendingOHLCVData(40);
      const adx = service.calculateADX(ohlcvData, 14);
      
      expect(adx).not.toBeNull();
      expect(adx!).toBeGreaterThanOrEqual(0);
      expect(adx!).toBeLessThanOrEqual(100);
    });

    it('should return null for insufficient data', () => {
      const ohlcvData: OHLCV[] = generateOHLCVData(20);
      const adx = service.calculateADX(ohlcvData, 14);
      
      expect(adx).toBeNull();
    });

    it('should return higher ADX for strongly trending data', () => {
      // Sideways data
      const sidewaysData: OHLCV[] = [];
      for (let i = 0; i < 40; i++) {
        const base = 100 + (i % 2 === 0 ? 1 : -1);
        sidewaysData.push({
          timestamp: new Date(2024, 0, i + 1),
          open: base,
          high: base + 1,
          low: base - 1,
          close: base,
          volume: 1000000,
        });
      }
      
      // Strong uptrend data
      const trendingData: OHLCV[] = [];
      for (let i = 0; i < 40; i++) {
        const base = 100 + i * 2;
        trendingData.push({
          timestamp: new Date(2024, 0, i + 1),
          open: base,
          high: base + 3,
          low: base - 1,
          close: base + 2,
          volume: 1000000,
        });
      }
      
      const sidewaysADX = service.calculateADX(sidewaysData, 14);
      const trendingADX = service.calculateADX(trendingData, 14);
      
      expect(trendingADX!).toBeGreaterThan(sidewaysADX!);
    });
  });

  describe('calculateTechnicalIndicators', () => {
    it('should calculate all indicators for valid data', () => {
      const ohlcvData: OHLCV[] = generateOHLCVData(250);
      const indicators = service.calculateTechnicalIndicators('AAPL', ohlcvData);
      
      expect(indicators.symbol).toBe('AAPL');
      expect(indicators.rsi14).not.toBeNull();
      expect(indicators.macd).not.toBeNull();
      expect(indicators.sma20).not.toBeNull();
      expect(indicators.sma50).not.toBeNull();
      expect(indicators.sma200).not.toBeNull();
      expect(indicators.ema12).not.toBeNull();
      expect(indicators.ema26).not.toBeNull();
      expect(indicators.bollingerBands).not.toBeNull();
      expect(indicators.atr14).not.toBeNull();
      expect(indicators.adx14).not.toBeNull();
    });

    it('should return null for indicators with insufficient data', () => {
      const ohlcvData: OHLCV[] = generateOHLCVData(30);
      const indicators = service.calculateTechnicalIndicators('AAPL', ohlcvData);
      
      expect(indicators.symbol).toBe('AAPL');
      expect(indicators.sma20).not.toBeNull();
      expect(indicators.sma200).toBeNull(); // Not enough data for 200-period SMA
    });

    it('should normalize symbol to uppercase', () => {
      const ohlcvData: OHLCV[] = generateOHLCVData(50);
      const indicators = service.calculateTechnicalIndicators('aapl', ohlcvData);
      
      expect(indicators.symbol).toBe('AAPL');
    });
  });

  describe('getTechnicalIndicators', () => {
    it('should return cached indicators when cache hit', async () => {
      const cachedIndicators = {
        symbol: 'AAPL',
        rsi14: 55.5,
        macd: { value: 1.5, signal: 1.2, histogram: 0.3 },
        sma20: 150.0,
        sma50: 148.0,
        sma200: 145.0,
        ema12: 151.0,
        ema26: 149.0,
        bollingerBands: { upper: 160.0, middle: 150.0, lower: 140.0 },
        atr14: 3.5,
        adx14: 25.0,
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedIndicators);

      const ohlcvData: OHLCV[] = generateOHLCVData(50);
      const result = await service.getTechnicalIndicators('AAPL', ohlcvData);

      expect(result.symbol).toBe('AAPL');
      expect(result.rsi14).toBe(55.5);
      expect(redisHelpers.getJson).toHaveBeenCalled();
    });

    it('should calculate and cache indicators when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);

      const ohlcvData: OHLCV[] = generateOHLCVData(50);
      const result = await service.getTechnicalIndicators('AAPL', ohlcvData);

      expect(result.symbol).toBe('AAPL');
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should continue with calculation when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const ohlcvData: OHLCV[] = generateOHLCVData(50);
      const result = await service.getTechnicalIndicators('AAPL', ohlcvData);

      expect(result.symbol).toBe('AAPL');
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const ohlcvData: OHLCV[] = generateOHLCVData(50);
      const result = await service.getTechnicalIndicators('AAPL', ohlcvData);

      expect(result.symbol).toBe('AAPL');
    });
  });

  describe('calculateFundamentalMetrics', () => {
    it('should calculate all metrics for valid data', () => {
      const financialData = {
        price: 150,
        earnings: 6,
        forwardEarnings: 7,
        earningsGrowth: 15,
        sales: 400000000000,
        bookValue: 50,
        eps: 6,
        epsGrowth: 15,
        revenue: 400000000000,
        revenueGrowth: 10,
        grossProfit: 160000000000,
        operatingIncome: 100000000000,
        netIncome: 80000000000,
        totalEquity: 100000000000,
        totalAssets: 350000000000,
        totalDebt: 120000000000,
        currentAssets: 150000000000,
        currentLiabilities: 100000000000,
        dividendPerShare: 0.92,
        sharesOutstanding: 16000000000,
      };
      
      const metrics = service.calculateFundamentalMetrics('AAPL', financialData);
      
      expect(metrics.symbol).toBe('AAPL');
      expect(metrics.pe).toBe(25); // 150 / 6
      expect(metrics.forwardPe).toBeCloseTo(21.43, 1); // 150 / 7
      expect(metrics.peg).toBeCloseTo(1.67, 1); // 25 / 15
      expect(metrics.pb).toBe(3); // 150 / 50
      expect(metrics.eps).toBe(6);
      expect(metrics.epsGrowth).toBe(15);
      expect(metrics.grossMargin).toBe(40); // (160B / 400B) * 100
      expect(metrics.operatingMargin).toBe(25); // (100B / 400B) * 100
      expect(metrics.netMargin).toBe(20); // (80B / 400B) * 100
      expect(metrics.roe).toBe(80); // (80B / 100B) * 100
      expect(metrics.roa).toBeCloseTo(22.86, 1); // (80B / 350B) * 100
      expect(metrics.debtToEquity).toBe(1.2); // 120B / 100B
      expect(metrics.currentRatio).toBe(1.5); // 150B / 100B
      expect(metrics.dividendYield).toBeCloseTo(0.61, 1); // (0.92 / 150) * 100
      expect(metrics.payoutRatio).toBeCloseTo(15.33, 1); // (0.92 / 6) * 100
    });

    it('should return null for missing data', () => {
      const metrics = service.calculateFundamentalMetrics('AAPL', {});
      
      expect(metrics.symbol).toBe('AAPL');
      expect(metrics.pe).toBeNull();
      expect(metrics.forwardPe).toBeNull();
      expect(metrics.peg).toBeNull();
      expect(metrics.ps).toBeNull();
      expect(metrics.pb).toBeNull();
      expect(metrics.eps).toBeNull();
      expect(metrics.epsGrowth).toBeNull();
      expect(metrics.revenue).toBeNull();
      expect(metrics.revenueGrowth).toBeNull();
      expect(metrics.grossMargin).toBeNull();
      expect(metrics.operatingMargin).toBeNull();
      expect(metrics.netMargin).toBeNull();
      expect(metrics.roe).toBeNull();
      expect(metrics.roa).toBeNull();
      expect(metrics.debtToEquity).toBeNull();
      expect(metrics.currentRatio).toBeNull();
      expect(metrics.dividendYield).toBeNull();
      expect(metrics.payoutRatio).toBeNull();
    });

    it('should handle zero denominators gracefully', () => {
      const financialData = {
        price: 150,
        earnings: 0, // Zero earnings
        revenue: 0, // Zero revenue
        totalEquity: 0, // Zero equity
      };
      
      const metrics = service.calculateFundamentalMetrics('AAPL', financialData);
      
      expect(metrics.pe).toBeNull();
      expect(metrics.grossMargin).toBeNull();
      expect(metrics.roe).toBeNull();
    });

    it('should normalize symbol to uppercase', () => {
      const metrics = service.calculateFundamentalMetrics('aapl', { price: 150 });
      
      expect(metrics.symbol).toBe('AAPL');
    });
  });

  describe('getFundamentalMetrics', () => {
    it('should return cached metrics when cache hit', async () => {
      const cachedMetrics = {
        symbol: 'AAPL',
        pe: 25,
        forwardPe: 21.43,
        peg: 1.67,
        ps: 6,
        pb: 3,
        eps: 6,
        epsGrowth: 15,
        revenue: 400000000000,
        revenueGrowth: 10,
        grossMargin: 40,
        operatingMargin: 25,
        netMargin: 20,
        roe: 80,
        roa: 22.86,
        debtToEquity: 1.2,
        currentRatio: 1.5,
        dividendYield: 0.61,
        payoutRatio: 15.33,
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedMetrics);

      const result = await service.getFundamentalMetrics('AAPL', { price: 150 });

      expect(result.symbol).toBe('AAPL');
      expect(result.pe).toBe(25);
      expect(redisHelpers.getJson).toHaveBeenCalled();
    });

    it('should calculate and cache metrics when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);

      const result = await service.getFundamentalMetrics('AAPL', { price: 150, earnings: 6 });

      expect(result.symbol).toBe('AAPL');
      expect(result.pe).toBe(25);
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should continue with calculation when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await service.getFundamentalMetrics('AAPL', { price: 150, earnings: 6 });

      expect(result.symbol).toBe('AAPL');
      expect(result.pe).toBe(25);
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await service.getFundamentalMetrics('AAPL', { price: 150, earnings: 6 });

      expect(result.symbol).toBe('AAPL');
      expect(result.pe).toBe(25);
    });
  });
});

// Helper function to generate OHLCV test data
function generateOHLCVData(count: number): OHLCV[] {
  const data: OHLCV[] = [];
  let basePrice = 100;
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 4;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    
    data.push({
      timestamp: new Date(2024, 0, i + 1),
      open,
      high,
      low,
      close,
      volume: Math.floor(1000000 + Math.random() * 500000),
    });
    
    basePrice = close;
  }
  
  return data;
}

// Helper function to generate trending OHLCV test data
function generateTrendingOHLCVData(count: number): OHLCV[] {
  const data: OHLCV[] = [];
  let basePrice = 100;
  
  for (let i = 0; i < count; i++) {
    const trend = 0.5; // Upward trend
    const noise = (Math.random() - 0.5) * 2;
    const change = trend + noise;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * 1;
    const low = Math.min(open, close) - Math.random() * 1;
    
    data.push({
      timestamp: new Date(2024, 0, i + 1),
      open,
      high,
      low,
      close,
      volume: Math.floor(1000000 + Math.random() * 500000),
    });
    
    basePrice = close;
  }
  
  return data;
}
