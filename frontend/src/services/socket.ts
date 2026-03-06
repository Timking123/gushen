import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

// Price update callback type
type PriceUpdateCallback = (data: {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: string
}) => void

// Store callbacks for price updates
const priceUpdateCallbacks: Map<string, Set<PriceUpdateCallback>> = new Map()
const globalPriceCallbacks: Set<PriceUpdateCallback> = new Set()

export const initSocket = (token?: string): Socket => {
  if (socket?.connected) {
    return socket
  }

  socket = io(import.meta.env.VITE_WS_URL, {
    autoConnect: false,
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id)
  })

  socket.on('disconnect', reason => {
    console.log('Socket disconnected:', reason)
  })

  socket.on('connect_error', error => {
    console.error('Socket connection error:', error)
  })

  // Handle real-time price updates for specific stocks
  socket.on('price:update', (data: {
    symbol: string
    price: number
    change: number
    changePercent: number
    volume: number
    timestamp: string
  }) => {
    // Call symbol-specific callbacks
    const callbacks = priceUpdateCallbacks.get(data.symbol)
    if (callbacks) {
      callbacks.forEach(cb => cb(data))
    }
  })

  // Handle market-wide price updates
  socket.on('market:price', (data: {
    symbol: string
    price: number
    change: number
    changePercent: number
    volume: number
    timestamp: string
  }) => {
    // Call global callbacks
    globalPriceCallbacks.forEach(cb => cb(data))
  })

  return socket
}

export const getSocket = (): Socket | null => socket

export const connectSocket = (): void => {
  socket?.connect()
}

export const disconnectSocket = (): void => {
  socket?.disconnect()
}

/**
 * Subscribe to real-time price updates for a specific stock
 */
export const subscribeToStock = (symbol: string, callback: PriceUpdateCallback): () => void => {
  // Add callback to the map
  if (!priceUpdateCallbacks.has(symbol)) {
    priceUpdateCallbacks.set(symbol, new Set())
  }
  priceUpdateCallbacks.get(symbol)!.add(callback)

  // Tell server to subscribe to this stock
  socket?.emit('subscribe:stock', symbol)

  // Return unsubscribe function
  return () => {
    const callbacks = priceUpdateCallbacks.get(symbol)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        priceUpdateCallbacks.delete(symbol)
        socket?.emit('unsubscribe:stock', symbol)
      }
    }
  }
}

/**
 * Subscribe to all market price updates
 */
export const subscribeToMarketPrices = (callback: PriceUpdateCallback): () => void => {
  globalPriceCallbacks.add(callback)

  return () => {
    globalPriceCallbacks.delete(callback)
  }
}

/**
 * Authenticate user on socket connection
 */
export const authenticateSocket = (userId: string): void => {
  socket?.emit('authenticate', userId)
}

export default socket
