import { io, type Socket } from 'socket.io-client';

/**
 * Connection state emitted to listeners (Requirement 5.6)
 */
export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

/**
 * Configuration for the WebSocket client
 */
export interface WebSocketClientConfig {
  url: string;
  auth?: Record<string, unknown>;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms for exponential backoff (default: 30000) */
  maxDelay?: number;
  /** Maximum number of reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
}

type EventHandler = (data: unknown) => void;

/**
 * Calculate exponential backoff delay (Requirement 5.3).
 * Formula: delay = min(baseDelay * 2^attempt, maxDelay)
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  if (attempt < 0) return baseDelay;
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

/**
 * WebSocket client with exponential backoff reconnection and
 * connection state notifications (Requirements 5.3, 5.6).
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private readonly config: Required<WebSocketClientConfig>;
  private _reconnectAttempts = 0;
  private _isConnected = false;
  private _connectionState: ConnectionState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private stateHandlers: Set<(state: ConnectionState) => void> = new Set();

  constructor(config: WebSocketClientConfig) {
    this.config = {
      url: config.url,
      auth: config.auth ?? {},
      baseDelay: config.baseDelay ?? DEFAULT_BASE_DELAY,
      maxDelay: config.maxDelay ?? DEFAULT_MAX_DELAY,
      maxReconnectAttempts: config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(this.config.url, {
      autoConnect: false,
      auth: this.config.auth,
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection ourselves
    });

    this.setupListeners();
    this.socket.connect();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this._reconnectAttempts = 0;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.setConnectionState('disconnected');
  }

  /**
   * Subscribe to a channel (e.g., stock or sector)
   */
  subscribe(channel: string): void {
    this.socket?.emit('subscribe:stock', channel);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): void {
    this.socket?.emit('unsubscribe:stock', channel);
  }

  /**
   * Register an event handler
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // If socket is already connected, attach the handler immediately
    this.socket?.on(event, handler);
  }

  /**
   * Remove an event handler
   */
  off(event: string, handler?: EventHandler): void {
    if (handler) {
      this.eventHandlers.get(event)?.delete(handler);
      this.socket?.off(event, handler);
    } else {
      this.eventHandlers.delete(event);
      this.socket?.off(event);
    }
  }

  /**
   * Listen for connection state changes (Requirement 5.6)
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Get the underlying socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this._reconnectAttempts = 0;
      this.setConnectionState('connected');

      // Re-attach all registered event handlers
      for (const [event, handlers] of this.eventHandlers) {
        for (const handler of handlers) {
          this.socket?.on(event, handler);
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.setConnectionState('disconnected');

      // If the server closed the connection or transport closed, attempt reconnect
      if (reason === 'io server disconnect') {
        // Server forced disconnect — try reconnecting
        this.attemptReconnect();
      } else if (reason !== 'io client disconnect') {
        // Not a manual client disconnect — try reconnecting
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', () => {
      this.setConnectionState('disconnected');
      this.attemptReconnect();
    });
  }

  /**
   * Attempt reconnection with exponential backoff (Requirement 5.3).
   * delay = min(baseDelay * 2^attempt, maxDelay)
   */
  private attemptReconnect(): void {
    if (this._reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.setConnectionState('disconnected');
      return;
    }

    this.setConnectionState('reconnecting');

    const delay = calculateBackoffDelay(
      this._reconnectAttempts,
      this.config.baseDelay,
      this.config.maxDelay,
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this._reconnectAttempts++;
      this.socket?.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setConnectionState(state: ConnectionState): void {
    const changed = this._connectionState !== state;
    this._connectionState = state;
    this._isConnected = state === 'connected';

    if (changed) {
      for (const handler of this.stateHandlers) {
        try {
          handler(state);
        } catch {
          // Don't let handler errors break state management
        }
      }
    }
  }
}
