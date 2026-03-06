# Frontend Services Documentation

## Notification Service

The notification service handles real-time push notifications from the backend via WebSocket (Socket.IO).

### Features

1. **Real-time Notifications**: Receives push notifications via WebSocket
2. **Browser Notifications**: Shows native browser notifications (with permission)
3. **Notification History**: Maintains a list of recent notifications (max 100)
4. **Multiple Subscribers**: Supports multiple components subscribing to notifications
5. **Stock/Sector Subscriptions**: Subscribe to specific stocks or sectors for updates

### Usage

#### Initialize the Service

```typescript
import { notificationService } from './services/notificationService';
import { initSocket, connectSocket } from './services/socket';

// Initialize socket connection
const token = localStorage.getItem('token');
initSocket(token);
connectSocket();

// Initialize notification service
notificationService.init(userId);

// Request browser notification permission
await notificationService.requestPermission();
```

#### Subscribe to Notifications

```typescript
import { notificationService, type PushNotification } from './services/notificationService';

// Subscribe to notifications
const unsubscribe = notificationService.subscribe((notification: PushNotification) => {
  console.log('New notification:', notification);
  // Handle notification (e.g., show toast, update UI)
});

// Later, unsubscribe
unsubscribe();
```

#### Subscribe to Stock Updates

```typescript
// Subscribe to a specific stock
notificationService.subscribeToStock('AAPL');

// Unsubscribe from a stock
notificationService.unsubscribeFromStock('AAPL');
```

#### Subscribe to Sector Updates

```typescript
// Subscribe to a sector
notificationService.subscribeToSector('Technology');

// Unsubscribe from a sector
notificationService.unsubscribeFromSector('Technology');
```

#### Get Notification History

```typescript
// Get all notifications
const notifications = notificationService.getNotifications();

// Clear all notifications
notificationService.clearNotifications();
```

### Notification Types

```typescript
interface PushNotification {
  type: 'price' | 'news' | 'earnings' | 'dividend' | 'insider' | 'rating' | 'sec_filing';
  symbol?: string;        // Stock symbol (if applicable)
  sector?: string;        // Sector name (if applicable)
  title: string;          // Notification title
  message: string;        // Notification message
  priority: 'high' | 'medium' | 'low';  // Priority level
  metadata?: Record<string, unknown>;   // Additional data
}
```

### Priority Levels

- **High**: Important alerts (e.g., significant price changes, earnings reports)
- **Medium**: Regular updates (e.g., news articles, analyst ratings)
- **Low**: Informational notifications (e.g., general market updates)

### Browser Notifications

The service automatically shows browser notifications when:
1. Browser supports notifications
2. User has granted notification permission
3. A new notification is received

High-priority notifications require user interaction to dismiss.

### Integration with NotificationPanel Component

The `NotificationPanel` component provides a UI for viewing notifications:

```typescript
import { NotificationPanel } from './components/NotificationPanel';

// Add to your app
<NotificationPanel />
```

Features:
- Bell icon with unread count badge
- Dropdown list of notifications
- Color-coded by priority (red=high, orange=medium, green=low)
- Icons for different notification types
- Clear all button

### Cleanup

Always cleanup when unmounting:

```typescript
useEffect(() => {
  // Initialize
  notificationService.init(userId);

  return () => {
    // Cleanup
    notificationService.cleanup();
  };
}, [userId]);
```

## Socket Service

The socket service manages WebSocket connections using Socket.IO.

### Features

1. **Auto-reconnection**: Automatically reconnects on disconnect (max 5 attempts)
2. **Authentication**: Supports JWT token authentication
3. **Connection Management**: Connect/disconnect on demand
4. **Event Handling**: Built-in connection/disconnection/error handlers

### Usage

```typescript
import { initSocket, connectSocket, disconnectSocket, getSocket } from './services/socket';

// Initialize with token
const token = localStorage.getItem('token');
const socket = initSocket(token);

// Connect
connectSocket();

// Get socket instance
const socket = getSocket();

// Listen to custom events
socket?.on('custom:event', (data) => {
  console.log('Custom event:', data);
});

// Emit events
socket?.emit('custom:action', { data: 'value' });

// Disconnect
disconnectSocket();
```

### Configuration

Socket configuration is in `.env`:

```
VITE_WS_URL=http://localhost:4000
```

### Connection States

- **Connected**: Socket is connected and ready
- **Disconnected**: Socket is disconnected
- **Reconnecting**: Socket is attempting to reconnect

### Events

Built-in events:
- `connect`: Socket connected
- `disconnect`: Socket disconnected
- `connect_error`: Connection error

Custom events (from backend):
- `push:notification`: Push notification received
- `stock:update`: Stock price update
- `sector:update`: Sector update

## API Service

The API service handles HTTP requests to the backend.

### Features

1. **Axios Instance**: Pre-configured Axios instance
2. **Auto-authentication**: Automatically adds JWT token to requests
3. **Error Handling**: Centralized error handling
4. **Base URL**: Configured from environment variables

### Usage

```typescript
import api from './services/api';

// GET request
const response = await api.get('/stocks/search', {
  params: { query: 'AAPL' }
});

// POST request
const response = await api.post('/watchlist', {
  symbol: 'AAPL'
});

// PUT request
const response = await api.put('/user/settings', {
  theme: 'dark'
});

// DELETE request
const response = await api.delete('/watchlist/AAPL');
```

### Configuration

API configuration is in `.env`:

```
VITE_API_BASE_URL=http://localhost:4000/api
```

### Error Handling

The API service automatically handles:
- 401 Unauthorized: Redirects to login
- Network errors: Shows error message
- Server errors: Shows error message

### Response Format

All API responses follow this format:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```
