import { useState, useRef, useEffect, useCallback } from 'react'
import './HeatmapNavigation.css'

export type HeatmapGroupBy = 'sector' | 'marketCap' | 'industry'

interface NavigationOption {
  value: HeatmapGroupBy
  label: string
  icon: string
}

interface HeatmapNavigationProps {
  currentGroupBy: HeatmapGroupBy
  onGroupByChange: (groupBy: HeatmapGroupBy) => void
  className?: string
}

const navigationOptions: NavigationOption[] = [
  { value: 'sector', label: '按板块', icon: '📊' },
  { value: 'marketCap', label: '按市值', icon: '💰' },
  { value: 'industry', label: '按行业', icon: '🏭' },
]

/**
 * HeatmapNavigation Component
 * 
 * Dropdown navigation menu for heatmap grouping options.
 * 
 * Implements Requirements 11.1-11.4:
 * - 11.1: Keep navigation menu expanded after clicking the button
 * - 11.2: Close menu when clicking outside
 * - 11.3: Execute action but keep menu expanded when selecting option
 * - 11.4: Close menu when pressing ESC key
 */
export const HeatmapNavigation = ({
  currentGroupBy,
  onGroupByChange,
  className = '',
}: HeatmapNavigationProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Get current option label
  const currentOption = navigationOptions.find(opt => opt.value === currentGroupBy)

  /**
   * Toggle menu open/close
   * Implements Requirement 11.1: Keep menu expanded after clicking
   */
  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  /**
   * Handle option selection
   * Implements Requirement 11.3: Execute action but keep menu expanded
   */
  const handleOptionClick = useCallback((value: HeatmapGroupBy) => {
    onGroupByChange(value)
    // Menu stays open after selection (Requirement 11.3)
  }, [onGroupByChange])

  /**
   * Handle click outside to close menu
   * Implements Requirement 11.2: Close menu when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  /**
   * Handle ESC key to close menu
   * Implements Requirement 11.4: Close menu when pressing ESC
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className={`heatmap-navigation ${className}`}>
      <button
        ref={buttonRef}
        className={`navigation-toggle ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="toggle-icon">{currentOption?.icon}</span>
        <span className="toggle-label">{currentOption?.label}</span>
        <span className={`toggle-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div 
          ref={menuRef}
          className="navigation-menu"
          role="menu"
        >
          {navigationOptions.map(option => (
            <button
              key={option.value}
              className={`navigation-option ${currentGroupBy === option.value ? 'active' : ''}`}
              onClick={() => handleOptionClick(option.value)}
              role="menuitem"
            >
              <span className="option-icon">{option.icon}</span>
              <span className="option-label">{option.label}</span>
              {currentGroupBy === option.value && (
                <span className="option-check">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
