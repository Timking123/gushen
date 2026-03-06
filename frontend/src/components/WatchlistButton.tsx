import React, { useState, useEffect, useCallback } from 'react';
import { watchlistApi } from '../services/watchlistApi';
import { useAuthStore } from '../stores/authStore';
import { toast } from './Toast';
import './WatchlistButton.css';

/**
 * WatchlistButton Component
 * 
 * Displays an add/remove watchlist button for a stock.
 * Handles different states: not logged in, in watchlist, not in watchlist.
 * 
 * Requirements:
 * - 9.1: 显示"添加自选"按钮
 * - 9.2: 股票已在自选股中时显示"已添加"状态和"移除自选"按钮
 * - 9.3: 点击"添加自选"按钮将该股票添加到用户的自选股列表
 * - 9.4: 点击"移除自选"按钮将该股票从用户的自选股列表移除
 * - 9.5: 添加/移除操作完成后显示操作成功的提示信息
 * - 9.6: 用户未登录时提示用户登录后才能添加自选股
 */

export interface WatchlistButtonProps {
  symbol: string;
  className?: string;
  onStatusChange?: (isInWatchlist: boolean) => void;
}

export const WatchlistButton: React.FC<WatchlistButtonProps> = ({
  symbol,
  className = '',
  onStatusChange,
}) => {
  const [isInWatchlist, setIsInWatchlist] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [operating, setOperating] = useState<boolean>(false);
  
  const { isAuthenticated } = useAuthStore();

  // Check if stock is in watchlist on mount and when symbol changes
  const checkWatchlistStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setIsInWatchlist(false);
      return;
    }

    try {
      setLoading(true);
      const inWatchlist = await watchlistApi.isInWatchlist(symbol);
      setIsInWatchlist(inWatchlist);
    } catch (error) {
      console.error('Failed to check watchlist status:', error);
      setIsInWatchlist(false);
    } finally {
      setLoading(false);
    }
  }, [symbol, isAuthenticated]);

  useEffect(() => {
    checkWatchlistStatus();
  }, [checkWatchlistStatus]);

  // Handle add to watchlist
  const handleAdd = async () => {
    if (!isAuthenticated) {
      toast.warning('请先登录', '登录后才能添加自选股');
      return;
    }

    try {
      setOperating(true);
      await watchlistApi.addStock(symbol);
      setIsInWatchlist(true);
      toast.success('添加成功', `${symbol} 已添加到自选股`);
      onStatusChange?.(true);
    } catch (error: unknown) {
      console.error('Failed to add to watchlist:', error);
      // Check for specific error messages
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'error' in error.response.data
      ) {
        const errorMessage = error.response.data.error as string;
        // Check for specific error types
        if (errorMessage.includes('不存在')) {
          toast.error('添加失败', `股票 ${symbol} 不存在于数据库中`);
        } else if (errorMessage.includes('已在自选股')) {
          toast.info('提示', errorMessage);
          setIsInWatchlist(true);
        } else {
          toast.error('添加失败', errorMessage);
        }
      } else if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response
      ) {
        const status = error.response.status as number;
        if (status === 401) {
          // User token is invalid or user doesn't exist - need to re-login
          toast.warning('登录已失效', '请退出后重新登录');
          // Clear auth state to force re-login
          const { logout } = useAuthStore.getState();
          logout();
        } else if (status === 404) {
          toast.error('添加失败', `股票 ${symbol} 不存在于数据库中`);
        } else if (status === 409) {
          toast.info('提示', `${symbol} 已在自选股列表中`);
          setIsInWatchlist(true);
        } else {
          toast.error('添加失败', '服务器错误，请稍后重试');
        }
      } else {
        toast.error('添加失败', '无法添加到自选股，请稍后重试');
      }
    } finally {
      setOperating(false);
    }
  };

  // Handle remove from watchlist
  const handleRemove = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setOperating(true);
      await watchlistApi.removeStock(symbol);
      setIsInWatchlist(false);
      toast.success('移除成功', `${symbol} 已从自选股移除`);
      onStatusChange?.(false);
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
      toast.error('移除失败', '无法从自选股移除，请稍后重试');
    } finally {
      setOperating(false);
    }
  };

  // Handle click - show login prompt if not authenticated
  const handleClick = () => {
    if (!isAuthenticated) {
      toast.warning('请先登录', '登录后才能添加自选股');
      return;
    }

    if (isInWatchlist) {
      handleRemove();
    } else {
      handleAdd();
    }
  };

  // Determine button state and content
  const getButtonContent = () => {
    if (loading) {
      return {
        text: '加载中...',
        icon: '⏳',
        disabled: true,
      };
    }

    if (operating) {
      return {
        text: isInWatchlist ? '移除中...' : '添加中...',
        icon: '⏳',
        disabled: true,
      };
    }

    if (!isAuthenticated) {
      return {
        text: '添加自选',
        icon: '☆',
        disabled: false,
      };
    }

    if (isInWatchlist) {
      return {
        text: '移除自选',
        icon: '★',
        disabled: false,
      };
    }

    return {
      text: '添加自选',
      icon: '☆',
      disabled: false,
    };
  };

  const buttonContent = getButtonContent();
  const buttonClass = `watchlist-button ${className} ${
    isInWatchlist ? 'in-watchlist' : ''
  } ${loading || operating ? 'loading' : ''} ${!isAuthenticated ? 'not-authenticated' : ''}`;

  return (
    <button
      className={buttonClass}
      onClick={handleClick}
      disabled={buttonContent.disabled}
      title={
        !isAuthenticated
          ? '登录后才能添加自选股'
          : isInWatchlist
            ? '点击移除自选股'
            : '点击添加到自选股'
      }
    >
      <span className="watchlist-button-icon">{buttonContent.icon}</span>
      <span className="watchlist-button-text">{buttonContent.text}</span>
      {isInWatchlist && <span className="watchlist-status-badge">已添加</span>}
    </button>
  );
};

export default WatchlistButton;
