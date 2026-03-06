import { useState, useEffect, useRef, useCallback } from 'react'
import './SectorFilter.css'

/**
 * SectorFilter component props
 * Implements Requirements 14.1, 14.6
 */
export interface SectorFilterProps {
  sectors: string[]
  industries: string[]
  selectedSectors: string[]
  selectedIndustries: string[]
  onSectorChange: (sectors: string[]) => void
  onIndustryChange: (industries: string[]) => void
  className?: string
}

/**
 * SectorFilter Component
 * 
 * Provides multi-select dropdown menus for filtering heatmap by sector and industry.
 * 
 * Implements Requirements:
 * - 14.1: Display sector/industry filter dropdown
 * - 14.6: Support multi-select sector filtering
 */
export const SectorFilter = ({
  sectors,
  industries,
  selectedSectors,
  selectedIndustries,
  onSectorChange,
  onIndustryChange,
  className = '',
}: SectorFilterProps) => {
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState(false)
  const [industryDropdownOpen, setIndustryDropdownOpen] = useState(false)
  
  const sectorDropdownRef = useRef<HTMLDivElement>(null)
  const industryDropdownRef = useRef<HTMLDivElement>(null)

  /**
   * Handle click outside to close dropdowns
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(event.target as Node)) {
        setSectorDropdownOpen(false)
      }
      if (industryDropdownRef.current && !industryDropdownRef.current.contains(event.target as Node)) {
        setIndustryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  /**
   * Handle ESC key to close dropdowns
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSectorDropdownOpen(false)
        setIndustryDropdownOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  /**
   * Toggle sector selection
   */
  const handleSectorToggle = useCallback((sector: string) => {
    const newSelection = selectedSectors.includes(sector)
      ? selectedSectors.filter(s => s !== sector)
      : [...selectedSectors, sector]
    onSectorChange(newSelection)
  }, [selectedSectors, onSectorChange])

  /**
   * Toggle industry selection
   */
  const handleIndustryToggle = useCallback((industry: string) => {
    const newSelection = selectedIndustries.includes(industry)
      ? selectedIndustries.filter(i => i !== industry)
      : [...selectedIndustries, industry]
    onIndustryChange(newSelection)
  }, [selectedIndustries, onIndustryChange])

  /**
   * Select all sectors
   */
  const handleSelectAllSectors = useCallback(() => {
    onSectorChange([...sectors])
  }, [sectors, onSectorChange])

  /**
   * Clear all sector selections
   */
  const handleClearSectors = useCallback(() => {
    onSectorChange([])
  }, [onSectorChange])

  /**
   * Select all industries
   */
  const handleSelectAllIndustries = useCallback(() => {
    onIndustryChange([...industries])
  }, [industries, onIndustryChange])

  /**
   * Clear all industry selections
   */
  const handleClearIndustries = useCallback(() => {
    onIndustryChange([])
  }, [onIndustryChange])

  /**
   * Get display text for sector dropdown button
   */
  const getSectorButtonText = () => {
    if (selectedSectors.length === 0) {
      return '全部板块'
    }
    if (selectedSectors.length === 1) {
      return selectedSectors[0]
    }
    return `${selectedSectors.length} 个板块`
  }

  /**
   * Get display text for industry dropdown button
   */
  const getIndustryButtonText = () => {
    if (selectedIndustries.length === 0) {
      return '全部行业'
    }
    if (selectedIndustries.length === 1) {
      return selectedIndustries[0]
    }
    return `${selectedIndustries.length} 个行业`
  }

  return (
    <div className={`sector-filter ${className}`}>
      {/* Sector Filter Dropdown */}
      <div className="filter-dropdown" ref={sectorDropdownRef}>
        <button
          className={`filter-button ${sectorDropdownOpen ? 'active' : ''} ${selectedSectors.length > 0 ? 'has-selection' : ''}`}
          onClick={() => {
            setSectorDropdownOpen(!sectorDropdownOpen)
            setIndustryDropdownOpen(false)
          }}
          aria-expanded={sectorDropdownOpen}
          aria-haspopup="listbox"
        >
          <span className="filter-button-text">{getSectorButtonText()}</span>
          <span className={`filter-button-icon ${sectorDropdownOpen ? 'open' : ''}`}>▼</span>
        </button>
        
        {sectorDropdownOpen && (
          <div className="filter-dropdown-menu" role="listbox" aria-multiselectable="true">
            <div className="filter-dropdown-header">
              <button className="filter-action-button" onClick={handleSelectAllSectors}>
                全选
              </button>
              <button className="filter-action-button" onClick={handleClearSectors}>
                清除
              </button>
            </div>
            <div className="filter-dropdown-list">
              {sectors.map(sector => (
                <label key={sector} className="filter-option">
                  <input
                    type="checkbox"
                    checked={selectedSectors.includes(sector)}
                    onChange={() => handleSectorToggle(sector)}
                  />
                  <span className="filter-option-text">{sector}</span>
                </label>
              ))}
              {sectors.length === 0 && (
                <div className="filter-empty">暂无板块数据</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Industry Filter Dropdown */}
      <div className="filter-dropdown" ref={industryDropdownRef}>
        <button
          className={`filter-button ${industryDropdownOpen ? 'active' : ''} ${selectedIndustries.length > 0 ? 'has-selection' : ''}`}
          onClick={() => {
            setIndustryDropdownOpen(!industryDropdownOpen)
            setSectorDropdownOpen(false)
          }}
          aria-expanded={industryDropdownOpen}
          aria-haspopup="listbox"
        >
          <span className="filter-button-text">{getIndustryButtonText()}</span>
          <span className={`filter-button-icon ${industryDropdownOpen ? 'open' : ''}`}>▼</span>
        </button>
        
        {industryDropdownOpen && (
          <div className="filter-dropdown-menu" role="listbox" aria-multiselectable="true">
            <div className="filter-dropdown-header">
              <button className="filter-action-button" onClick={handleSelectAllIndustries}>
                全选
              </button>
              <button className="filter-action-button" onClick={handleClearIndustries}>
                清除
              </button>
            </div>
            <div className="filter-dropdown-list">
              {industries.map(industry => (
                <label key={industry} className="filter-option">
                  <input
                    type="checkbox"
                    checked={selectedIndustries.includes(industry)}
                    onChange={() => handleIndustryToggle(industry)}
                  />
                  <span className="filter-option-text">{industry}</span>
                </label>
              ))}
              {industries.length === 0 && (
                <div className="filter-empty">暂无行业数据</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Helper function to filter stocks by selected sectors
 * Implements Property 15: 板块筛选正确性
 * 
 * @param stocks - Array of stocks with sector property
 * @param selectedSectors - Array of selected sector names
 * @returns Filtered array of stocks
 */
export function filterBySectors<T extends { sector: string }>(
  stocks: T[],
  selectedSectors: string[]
): T[] {
  if (selectedSectors.length === 0) {
    return stocks
  }
  return stocks.filter(stock => selectedSectors.includes(stock.sector))
}

/**
 * Helper function to filter stocks by selected industries
 * Implements Property 15: 板块筛选正确性
 * 
 * @param stocks - Array of stocks with industry property
 * @param selectedIndustries - Array of selected industry names
 * @returns Filtered array of stocks
 */
export function filterByIndustries<T extends { industry: string | null }>(
  stocks: T[],
  selectedIndustries: string[]
): T[] {
  if (selectedIndustries.length === 0) {
    return stocks
  }
  return stocks.filter(stock => stock.industry !== null && selectedIndustries.includes(stock.industry))
}

/**
 * Helper function to filter stocks by multiple criteria (union)
 * Implements Property 16: 多选筛选正确性
 * 
 * @param stocks - Array of stocks
 * @param selectedSectors - Array of selected sector names
 * @param selectedIndustries - Array of selected industry names
 * @returns Filtered array of stocks (union of sector and industry filters)
 */
export function filterByMultipleCriteria<T extends { sector: string; industry: string | null }>(
  stocks: T[],
  selectedSectors: string[],
  selectedIndustries: string[]
): T[] {
  // If no filters selected, return all stocks
  if (selectedSectors.length === 0 && selectedIndustries.length === 0) {
    return stocks
  }
  
  // If only sectors selected, filter by sectors
  if (selectedIndustries.length === 0) {
    return filterBySectors(stocks, selectedSectors)
  }
  
  // If only industries selected, filter by industries
  if (selectedSectors.length === 0) {
    return filterByIndustries(stocks, selectedIndustries)
  }
  
  // If both selected, return union (stocks matching either sector OR industry)
  return stocks.filter(stock => 
    selectedSectors.includes(stock.sector) || 
    (stock.industry !== null && selectedIndustries.includes(stock.industry))
  )
}
