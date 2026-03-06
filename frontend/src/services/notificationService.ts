import { getSocket } from './socket'

export interface PushNotification {
  type: 'price' | 'news' | 'earnings' | 'dividend' | 'insider' | 'rating' | 'sec_filing'
  symbol?: string
  sector?: string
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  metadata?: Record<string, unknown>
}

export type NotificationHandler = (notification: PushNotification) => void

class NotificationService {
  private handlers: Set<NotificationHandler> = new Set()
  private notifications: PushNotification[] = []
  private maxNotifications = 100

  /**
   * Initialize notification service and listen for push notifications
   */
  init(userId: string): void {
    const socket = getSocket()
    if (!socket) {
      console.error('Socket not initialized')
      return
    }

    // Authenticate user with socket
    socket.emit('authenticate', userId)

    // Listen for push notifications
    socket.on('push:notification', (notification: PushNotification) => {
      this.handleNotification(notification)
    })

    console.log('Notification service initialized for user:', userId)
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(notification: PushNotification): void {
    // Add to notifications list
    this.notifications.unshift(notification)

    // Keep only the most recent notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications)
    }

    // Show browser notification if permitted
    this.showBrowserNotification(notification)

    // Notify all registered handlers
    this.handlers.forEach(handler => {
      try {
        handler(notification)
      } catch (error) {
        console.error('Error in notification handler:', error)
      }
    })
  }

  /**
   * Show browser notification
   */
  private showBrowserNotification(notification: PushNotification): void {
    if (!('Notification' in window)) {
      return
    }

    if (Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body: notification.message,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: notification.symbol || notification.type,
        requireInteraction: notification.priority === 'high',
      }

      const browserNotification = new Notification(notification.title, options)

      browserNotification.onclick = () => {
        window.focus()
        browserNotification.close()
      }
    }
  }

  /**
   * Request browser notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications')
      return 'denied'
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission
    }

    return Notification.permission
  }

  /**
   * Subscribe to notifications
   */
  subscribe(handler: NotificationHandler): () => void {
    this.handlers.add(handler)

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler)
    }
  }

  /**
   * Get all notifications
   */
  getNotifications(): PushNotification[] {
    return [...this.notifications]
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this.notifications = []
  }

  /**
   * Subscribe to stock updates
   */
  subscribeToStock(symbol: string): void {
    const socket = getSocket()
    if (socket) {
      socket.emit('subscribe:stock', symbol)
      console.log('Subscribed to stock:', symbol)
    }
  }

  /**
   * Unsubscribe from stock updates
   */
  unsubscribeFromStock(symbol: string): void {
    const socket = getSocket()
    if (socket) {
      socket.emit('unsubscribe:stock', symbol)
      console.log('Unsubscribed from stock:', symbol)
    }
  }

  /**
   * Subscribe to sector updates
   */
  subscribeToSector(sector: string): void {
    const socket = getSocket()
    if (socket) {
      socket.emit('subscribe:sector', sector)
      console.log('Subscribed to sector:', sector)
    }
  }

  /**
   * Unsubscribe from sector updates
   */
  unsubscribeFromSector(sector: string): void {
    const socket = getSocket()
    if (socket) {
      socket.emit('unsubscribe:sector', sector)
      console.log('Unsubscribed from sector:', sector)
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    const socket = getSocket()
    if (socket) {
      socket.off('push:notification')
    }
    this.handlers.clear()
    this.notifications = []
  }
}

export const notificationService = new NotificationService()
