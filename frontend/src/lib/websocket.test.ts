import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateBackoffDelay, WebSocketClient, ConnectionState } from './websocket';

// Mock socket.io-client
const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('calculateBackoffDelay', () => {
  it('should return baseDelay for attempt 0', () => {
    expect(calculateBackoffDelay(0, 1000, 30000)).toBe(1000);
  });

  it('should double delay for each attempt', () => {
    expect(calculateBackoffDelay(1, 1000, 30000)).toBe(2000);
    expect(calculateBackoffDelay(2, 1000, 30000)).toBe(4000);
    expect(calculateBackoffDelay(3, 1000, 30000)).toBe(8000);
    expect(calculateBackoffDelay(4, 1000, 30000)).toBe(16000);
  });

  it('should cap at maxDelay', () => {
    expect(calculateBackoffDelay(5, 1000, 30000)).toBe(30000);
    expect(calculateBackoffDelay(10, 1000, 30000)).toBe(30000);
    expect(calculateBackoffDelay(100, 1000, 30000)).toBe(30000);
  });

  it('should handle negative attempt by returning baseDelay', () => {
    expect(calculateBackoffDelay(-1, 1000, 30000)).toBe(1000);
  });

  it('should work with custom base and max delays', () => {
    expect(calculateBackoffDelay(0, 500, 10000)).toBe(500);
    expect(calculateBackoffDelay(3, 500, 10000)).toBe(4000);
    expect(calculateBackoffDelay(5, 500, 10000)).toBe(10000);
  });
});

describe('WebSocketClient', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSocket.connected = false;
    client = new WebSocketClient({
      url: 'http://localhost:3001',
      baseDelay: 1000,
      maxDelay: 30000,
      maxReconnectAttempts: 5,
    });
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
  });

  it('should start disconnected', () => {
    expect(client.isConnected).toBe(false);
    expect(client.reconnectAttempts).toBe(0);
    expect(client.connectionState).toBe('disconnected');
  });

  it('should call socket.connect() on connect()', () => {
    client.connect();
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('should not create a new socket if already connected', () => {
    // First connect to create the socket
    client.connect();
    // Now mark it as connected
    mockSocket.connected = true;
    mockSocket.connect.mockClear();

    // Second connect should bail out
    client.connect();
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('should set connected state when connect event fires', () => {
    client.connect();

    // Simulate the 'connect' event
    const connectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'connect',
    )?.[1] as () => void;
    expect(connectHandler).toBeDefined();

    connectHandler();
    expect(client.isConnected).toBe(true);
    expect(client.connectionState).toBe('connected');
    expect(client.reconnectAttempts).toBe(0);
  });

  it('should notify state change listeners', () => {
    const states: ConnectionState[] = [];
    client.onStateChange((state) => states.push(state));
    client.connect();

    // Simulate connect
    const connectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'connect',
    )?.[1] as () => void;
    connectHandler();

    expect(states).toContain('connected');
  });

  it('should allow unsubscribing from state changes', () => {
    const states: ConnectionState[] = [];
    const unsub = client.onStateChange((state) => states.push(state));
    unsub();

    client.connect();
    const connectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'connect',
    )?.[1] as () => void;
    connectHandler();

    expect(states).toHaveLength(0);
  });

  it('should attempt reconnect on disconnect with exponential backoff', () => {
    client.connect();

    const disconnectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'disconnect',
    )?.[1] as (reason: string) => void;

    // Simulate transport close (should trigger reconnect)
    disconnectHandler('transport close');
    expect(client.connectionState).toBe('reconnecting');

    // After baseDelay (1000ms), it should try to reconnect
    vi.advanceTimersByTime(1000);
    expect(mockSocket.connect).toHaveBeenCalledTimes(2); // initial + 1 reconnect
    expect(client.reconnectAttempts).toBe(1);
  });

  it('should not reconnect on manual client disconnect', () => {
    client.connect();

    const disconnectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'disconnect',
    )?.[1] as (reason: string) => void;

    disconnectHandler('io client disconnect');
    expect(client.connectionState).toBe('disconnected');

    vi.advanceTimersByTime(5000);
    // Should not have reconnected
    expect(mockSocket.connect).toHaveBeenCalledTimes(1); // only initial
  });

  it('should stop reconnecting after max attempts', () => {
    client.connect();

    const disconnectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'disconnect',
    )?.[1] as (reason: string) => void;

    // Simulate 5 disconnects (max attempts)
    for (let i = 0; i < 5; i++) {
      disconnectHandler('transport close');
      vi.advanceTimersByTime(30000); // advance past any backoff
    }

    // After max attempts, should stop
    disconnectHandler('transport close');
    expect(client.connectionState).toBe('disconnected');
  });

  it('should register and re-attach event handlers on connect', () => {
    const handler = vi.fn();
    client.on('test:event', handler);
    client.connect();

    // Simulate the 'connect' event — handlers get re-attached
    const connectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'connect',
    )?.[1] as () => void;
    connectHandler();

    // After connect fires, the handler should be attached
    expect(mockSocket.on).toHaveBeenCalledWith('test:event', handler);
  });

  it('should remove event handlers with off()', () => {
    const handler = vi.fn();
    client.on('test:event', handler);
    client.connect();

    client.off('test:event', handler);
    expect(mockSocket.off).toHaveBeenCalledWith('test:event', handler);
  });

  it('should emit subscribe and unsubscribe events', () => {
    client.connect();
    client.subscribe('AAPL');
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:stock', 'AAPL');

    client.unsubscribe('AAPL');
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:stock', 'AAPL');
  });

  it('should clean up on disconnect()', () => {
    client.connect();
    client.disconnect();

    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(client.isConnected).toBe(false);
    expect(client.reconnectAttempts).toBe(0);
  });
});
