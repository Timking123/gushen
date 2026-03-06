import { useState, useEffect } from 'react'
import { notificationService, type PushNotification } from '../services/notificationService'
import './NotificationPanel.css'

export const NotificationPanel = () => {
  const [notifications, setNotifications] = useState<PushNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Subscribe to new notifications
    const unsubscribe = notificationService.subscribe(notification => {
      setNotifications(prev => [notification, ...prev])
      setUnreadCount(prev => prev + 1)
    })

    // Load existing notifications
    setNotifications(notificationService.getNotifications())

    return () => {
      unsubscribe()
    }
  }, [])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      // Mark as read when opening
      setUnreadCount(0)
    }
  }

  const handleClear = () => {
    notificationService.clearNotifications()
    setNotifications([])
    setUnreadCount(0)
  }

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'notification-high'
      case 'medium':
        return 'notification-medium'
      case 'low':
        return 'notification-low'
      default:
        return ''
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'price':
        return '💰'
      case 'news':
        return '📰'
      case 'earnings':
        return '📊'
      case 'dividend':
        return '💵'
      case 'insider':
        return '👤'
      case 'rating':
        return '⭐'
      case 'sec_filing':
        return '📄'
      default:
        return '🔔'
    }
  }

  return (
    <div className="notification-panel">
      <button className="notification-bell" onClick={handleToggle}>
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>通知</h3>
            {notifications.length > 0 && (
              <button className="clear-button" onClick={handleClear}>
                清空
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">暂无通知</div>
            ) : (
              notifications.map((notification, index) => (
                <div
                  key={index}
                  className={`notification-item ${getPriorityClass(notification.priority)}`}
                >
                  <div className="notification-icon">{getTypeIcon(notification.type)}</div>
                  <div className="notification-content">
                    <div className="notification-title">
                      {notification.title}
                      {notification.symbol && (
                        <span className="notification-symbol">{notification.symbol}</span>
                      )}
                    </div>
                    <div className="notification-message">{notification.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
