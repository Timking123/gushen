import { Request } from 'express';
import { UserRole } from './roles.js';

// Extend Express Request to include user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: UserRole;
    permissions?: string[];
  };
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// User types
export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: 'zh' | 'en';
  timezone: string;
  pushEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  priceAlertThreshold: number;
  investmentPreferences: string[];
}

// Stock types
export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCap: number;
  country: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number | null;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
}

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TimeRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

// Watchlist types
export interface WatchlistItem {
  userId: string;
  symbol: string;
  addedAt: Date;
  sortOrder: number;
  notes: string | null;
}

// Alert types
export interface Alert {
  id: string;
  userId: string;
  type: 'price' | 'news' | 'earnings' | 'dividend' | 'insider' | 'rating';
  symbol: string | null;
  sector: string | null;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  condition: 'above' | 'below' | 'change_percent';
  targetValue: number;
  triggered: boolean;
  triggeredAt: Date | null;
  createdAt: Date;
}
