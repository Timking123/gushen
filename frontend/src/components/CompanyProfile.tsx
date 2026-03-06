import { useState, useEffect } from 'react'
import type { CompanyProfileData } from '../types'
import { formatMarketCap } from '../utils/formatters'
import { stockDetailApi } from '../services/stockDetailApi'
import './CompanyProfile.css'

interface CompanyProfileProps {
  symbol: string
  className?: string
}

/**
 * CompanyProfile Component
 * Displays company basic information including name, symbol, exchange,
 * sector, industry, market cap, and country.
 *
 * Implements Requirements:
 * - 2.1: 显示公司名称、股票代码、所属交易所
 * - 2.2: 显示公司所属行业和板块
 * - 2.3: 显示公司市值（格式化为易读形式，如 1.5T、200B）
 * - 2.4: 显示公司所在国家/地区
 * - 2.5: 对缺失字段显示"暂无数据"
 */
export function CompanyProfile({ symbol, className = '' }: CompanyProfileProps) {
  const [profile, setProfile] = useState<CompanyProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (symbol) {
      fetchProfile()
    }
  }, [symbol])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await stockDetailApi.getStockFullDetail(symbol)
      if (data) {
        setProfile(data.profile)
      } else {
        setError('未找到公司信息')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取公司信息失败'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`company-profile loading ${className}`}>
        <div className="loading-spinner" />
        <span>加载公司信息...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`company-profile error ${className}`}>
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchProfile}>
          重试
        </button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className={`company-profile empty ${className}`}>
        <span className="empty-icon">🏢</span>
        <span className="empty-message">暂无公司信息</span>
      </div>
    )
  }

  return (
    <div className={`company-profile ${className}`}>
      <div className="profile-header">
        {profile.logo && (
          <img 
            src={profile.logo} 
            alt={`${profile.name} logo`} 
            className="company-logo"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        <div className="profile-header-text">
          <h3 className="profile-title">公司概况</h3>
          <span className="profile-symbol">{symbol}</span>
        </div>
      </div>

      <div className="profile-content">
        {/* Primary info section - Name and Symbol prominently displayed */}
        <div className="profile-primary">
          <div className="primary-name">
            <span className="company-name">{profile.name || '暂无数据'}</span>
            <span className="company-symbol">{profile.symbol}</span>
          </div>
          <div className="primary-exchange">
            <span className="exchange-label">交易所</span>
            <span className="exchange-value">{profile.exchange || '暂无数据'}</span>
          </div>
        </div>

        {/* Details grid */}
        <div className="profile-details">
          <div className="detail-item">
            <span className="detail-icon">📊</span>
            <div className="detail-content">
              <span className="detail-label">板块</span>
              <span className="detail-value">{profile.sector || '暂无数据'}</span>
            </div>
          </div>

          <div className="detail-item">
            <span className="detail-icon">🏭</span>
            <div className="detail-content">
              <span className="detail-label">行业</span>
              <span className="detail-value">{profile.industry || '暂无数据'}</span>
            </div>
          </div>

          <div className="detail-item">
            <span className="detail-icon">💰</span>
            <div className="detail-content">
              <span className="detail-label">市值</span>
              <span className="detail-value market-cap">{formatMarketCap(profile.marketCap)}</span>
            </div>
          </div>

          <div className="detail-item">
            <span className="detail-icon">🌍</span>
            <div className="detail-content">
              <span className="detail-label">国家/地区</span>
              <span className="detail-value">{profile.country || '暂无数据'}</span>
            </div>
          </div>

          {profile.ipo && (
            <div className="detail-item">
              <span className="detail-icon">📅</span>
              <div className="detail-content">
                <span className="detail-label">上市日期</span>
                <span className="detail-value">{profile.ipo}</span>
              </div>
            </div>
          )}

          {profile.shareOutstanding && (
            <div className="detail-item">
              <span className="detail-icon">📈</span>
              <div className="detail-content">
                <span className="detail-label">流通股数</span>
                <span className="detail-value">{(profile.shareOutstanding / 1000000).toFixed(2)}M</span>
              </div>
            </div>
          )}
        </div>

        {/* Optional description */}
        {profile.description && (
          <div className="profile-description">
            <h4 className="description-title">公司简介</h4>
            <p className="description-text">{profile.description}</p>
          </div>
        )}

        {/* Optional additional info */}
        {(profile.website || profile.employees || profile.founded || profile.phone) && (
          <div className="profile-additional">
            {profile.website && (
              <div className="additional-item">
                <span className="additional-label">官网</span>
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="additional-link"
                >
                  {profile.website}
                </a>
              </div>
            )}
            {profile.phone && (
              <div className="additional-item">
                <span className="additional-label">电话</span>
                <span className="additional-value">{profile.phone}</span>
              </div>
            )}
            {profile.employees && (
              <div className="additional-item">
                <span className="additional-label">员工数</span>
                <span className="additional-value">{profile.employees.toLocaleString()}</span>
              </div>
            )}
            {profile.founded && (
              <div className="additional-item">
                <span className="additional-label">成立时间</span>
                <span className="additional-value">{profile.founded}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
