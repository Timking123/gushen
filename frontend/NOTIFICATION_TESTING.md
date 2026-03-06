# Testing the Notification System

## Manual Testing Guide

This guide explains how to manually test the frontend push notification system.

## Prerequisites

1. Backend server running on `http://localhost:4000`
2. Frontend development server running
3. User account created and logged in
4. Browser with notification support (Chrome, Firefox, Safari, Edge)

## Test Scenarios

### 1. Socket Connection Test

**Steps**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Log in to the application
4. Look for console messages:
   - "Socket connected: [socket-id]"
   - "Notification service initialized for user: [user-id]"

**Expected Result**: ✅ Socket connects successfully and notification service initializes

### 2. Browser Notification Permission Test

**Steps**:
1. Log in to the application
2. Browser should prompt for notification permission
3. Click "Allow"

**Expected Result**: ✅ Permission granted, browser notifications enabled

### 3. Real-time Notification Receiving Test

**Option A: Using Backend API**

```bash
# Send a test notification via backend API
curl -X POST http://localhost:4000/api/test/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "YOUR_USER_ID",
    "notification": {
      "type": "price",
      "symbol": "AAPL",
      "title": "Price Alert",
      "message": "AAPL price increased by 5%",
      "priority": "high"
    }
  }'
```

**Option B: Using Browser Console**

```javascript
// Simulate receiving a notification
const socket = window.io('http://localhost:4000', {
  auth: { token: localStorage.getItem('token') }
});

socket.emit('authenticate', 'YOUR_USER_ID');

// Manually trigger notification (for testing)
socket.emit('push:notification', {
  type: 'news',
  symbol: 'TSLA',
  title: 'Breaking News',
  message: 'Tesla announces new product',
  priority: 'medium'
});
```

**Expected Result**: 
- ✅ Notification appears in NotificationPanel
- ✅ Unread count badge updates
- ✅ Browser notification shows (if tab not focused)

### 4. Notification Panel UI Test

**Steps**:
1. Click the bell icon (🔔) in the header
2. Notification dropdown should open
3. Verify notification list displays correctly
4. Check priority colors:
   - High priority: Red left border
   - Medium priority: Orange left border
   - Low priority: Green left border
5. Check type icons:
   - 💰 for price alerts
   - 📰 for news
   - 📊 for earnings
   - 💵 for dividends
   - 👤 for insider trades
   - ⭐ for ratings
   - 📄 for SEC filings

**Expected Result**: ✅ All UI elements display correctly with proper styling

### 5. Clear Notifications Test

**Steps**:
1. Open notification panel
2. Click "清空" (Clear) button
3. Notification list should be empty
4. Unread count badge should disappear

**Expected Result**: ✅ All notifications cleared, badge removed

### 6. Stock Subscription Test

**Steps**:
1. Open browser console
2. Subscribe to a stock:
```javascript
notificationService.subscribeToStock('AAPL');
```
3. Check console for: "Subscribed to stock: AAPL"
4. Unsubscribe:
```javascript
notificationService.unsubscribeFromStock('AAPL');
```
5. Check console for: "Unsubscribed from stock: AAPL"

**Expected Result**: ✅ Subscription/unsubscription works correctly

### 7. Multiple Notifications Test

**Steps**:
1. Send multiple notifications rapidly
2. Open notification panel
3. Verify all notifications appear in order (newest first)
4. Scroll through the list

**Expected Result**: ✅ All notifications displayed in correct order

### 8. Notification Limit Test

**Steps**:
1. Send more than 100 notifications
2. Check notification list
3. Verify only the 100 most recent notifications are kept

**Expected Result**: ✅ List maintains max 100 notifications

### 9. Reconnection Test

**Steps**:
1. Log in and verify socket connected
2. Stop the backend server
3. Check console for disconnect message
4. Restart backend server
5. Wait for automatic reconnection (up to 5 attempts)
6. Check console for reconnect message

**Expected Result**: ✅ Socket automatically reconnects

### 10. Responsive Design Test

**Steps**:
1. Open application on desktop
2. Verify notification panel displays correctly
3. Open DevTools and toggle device toolbar (Ctrl+Shift+M)
4. Test on mobile viewport (375px width)
5. Verify notification panel adapts to mobile size

**Expected Result**: ✅ Responsive design works on all screen sizes

## Testing with Backend Push Service

### Test Price Alert

```bash
# Create a price alert
curl -X POST http://localhost:4000/api/push/alerts/price \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "symbol": "AAPL",
    "condition": "above",
    "targetValue": 150
  }'
```

### Test Stock Subscription

```bash
# Subscribe to stock
curl -X POST http://localhost:4000/api/push/subscribe/stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "symbol": "AAPL"
  }'
```

### Get Alerts

```bash
# Get all alerts
curl -X GET http://localhost:4000/api/push/alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get unread alerts only
curl -X GET "http://localhost:4000/api/push/alerts?unreadOnly=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Automated Testing (Future)

For automated testing, consider:

1. **Unit Tests**: Test notification service methods
2. **Integration Tests**: Test socket connection and message flow
3. **E2E Tests**: Test full user flow with Playwright/Cypress
4. **Visual Tests**: Test UI components with Storybook

## Common Issues and Solutions

### Issue: Socket not connecting

**Solution**:
- Check backend server is running
- Verify VITE_WS_URL in .env file
- Check JWT token is valid
- Check browser console for errors

### Issue: Browser notifications not showing

**Solution**:
- Check notification permission is granted
- Verify browser supports notifications
- Check browser notification settings
- Try in a different browser

### Issue: Notifications not appearing in panel

**Solution**:
- Check socket connection is established
- Verify user is authenticated
- Check browser console for errors
- Verify notification service is initialized

### Issue: Unread count not updating

**Solution**:
- Check notification panel is properly subscribed
- Verify state management is working
- Check React component is re-rendering

## Performance Testing

### Load Test

Send 100 notifications rapidly and verify:
- ✅ All notifications received
- ✅ UI remains responsive
- ✅ No memory leaks
- ✅ Smooth scrolling

### Memory Test

1. Open Chrome DevTools > Memory tab
2. Take heap snapshot
3. Send 1000 notifications
4. Take another heap snapshot
5. Compare memory usage

**Expected**: Memory usage should stabilize after reaching 100 notification limit

## Accessibility Testing

1. **Keyboard Navigation**: Tab through notification panel
2. **Screen Reader**: Test with NVDA/JAWS
3. **Color Contrast**: Verify WCAG AA compliance
4. **Focus Indicators**: Verify visible focus states

## Browser Compatibility

Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Conclusion

Follow this testing guide to ensure the notification system works correctly across all scenarios and browsers. Report any issues found during testing.
