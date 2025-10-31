# Architecture: SSE vs Polling

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Voice Agent                          │
│              (Listens to commands in Meet)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Calls API endpoints
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API Server                         │
│                  (server-redis.js)                          │
│                                                             │
│  POST /api/todos                                            │
│  POST /api/agents                                           │
│  POST /api/enhanced-todo                                    │
│  POST /api/doctor-notes                                     │
│  POST /api/ehr-data                                         │
│  POST /api/lab-results                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Saves to Redis
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Redis Cloud                              │
│              (Persistent Storage)                           │
│                                                             │
│  Key: "boardItems"                                          │
│  Value: JSON array of all items                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Notifies frontend
                     ▼
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  Browser Mode   │    │ Meet Add-on Mode│
│   (SSE) 📡      │    │  (Polling) 🔄   │
└─────────────────┘    └─────────────────┘
```

## Browser Mode (SSE) 📡

```
┌──────────────────────────────────────────────────────────┐
│                    Browser                               │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Frontend (React App)                          │    │
│  │                                                 │    │
│  │  useEffect(() => {                             │    │
│  │    const es = new EventSource('/api/events');  │    │
│  │    es.addEventListener('new-item', handler);   │    │
│  │  })                                            │    │
│  └────────────────┬───────────────────────────────┘    │
│                   │                                     │
│                   │ Persistent SSE Connection           │
│                   │ (Instant updates)                   │
└───────────────────┼─────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│              Backend SSE Endpoint                        │
│              GET /api/events                             │
│                                                          │
│  const sseClients = new Set();                          │
│                                                          │
│  app.get('/api/events', (req, res) => {                │
│    res.setHeader('Content-Type', 'text/event-stream'); │
│    sseClients.add(res);                                 │
│  });                                                    │
│                                                          │
│  const broadcastSSE = (message) => {                    │
│    for (const client of sseClients) {                   │
│      client.write(`event: new-item\n`);                │
│      client.write(`data: ${JSON.stringify(item)}\n\n`);│
│    }                                                    │
│  };                                                     │
└──────────────────────────────────────────────────────────┘

Timeline:
─────────────────────────────────────────────────────────────
0ms:   Agent calls API
10ms:  Redis saves item
15ms:  SSE broadcasts event
20ms:  Frontend receives event
25ms:  UI updates
─────────────────────────────────────────────────────────────
Total: ~25ms (instant)
```

## Meet Add-on Mode (Polling) 🔄

```
┌──────────────────────────────────────────────────────────┐
│              Google Meet Add-on                          │
│              (Sandboxed iframe)                          │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Frontend (React App)                          │    │
│  │                                                 │    │
│  │  useEffect(() => {                             │    │
│  │    // SSE blocked by CSP ❌                    │    │
│  │    // Use polling instead ✅                   │    │
│  │    setInterval(async () => {                   │    │
│  │      const res = await fetch('/api/board-items');│  │
│  │      const items = await res.json();           │    │
│  │      // Check for new items                    │    │
│  │    }, 2000);                                   │    │
│  │  })                                            │    │
│  └────────────────┬───────────────────────────────┘    │
│                   │                                     │
│                   │ HTTP Polling (every 2 seconds)      │
│                   │                                     │
└───────────────────┼─────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│              Backend API Endpoint                        │
│              GET /api/board-items                        │
│                                                          │
│  app.get('/api/board-items', async (req, res) => {     │
│    const items = await loadBoardItems(); // From Redis  │
│    res.json(items);                                     │
│  });                                                    │
└──────────────────────────────────────────────────────────┘

Timeline:
─────────────────────────────────────────────────────────────
0ms:    Agent calls API
10ms:   Redis saves item
15ms:   Item saved
...     (waiting for next poll)
2000ms: Frontend polls API
2010ms: Receives all items
2015ms: Detects new item
2020ms: UI updates
─────────────────────────────────────────────────────────────
Total: 0-2000ms (max 2 second delay)
```

## Automatic Detection

```typescript
// In src/App.tsx

const isInMeetAddon = window.location.pathname.includes('/meet/');

if (isInMeetAddon) {
  // ┌─────────────────────────────────────┐
  // │  Meet Add-on Detected               │
  // │  URL: /meet/Mainstage               │
  // │  Mode: Polling (2s interval)        │
  // │  Badge: 🔄 Polling Mode (Meet)      │
  // └─────────────────────────────────────┘
  
  pollingInterval = setInterval(pollForUpdates, 2000);
  
} else {
  // ┌─────────────────────────────────────┐
  // │  Regular Browser Detected           │
  // │  URL: /                             │
  // │  Mode: SSE (instant)                │
  // │  Badge: 📡 Live Updates (SSE)       │
  // └─────────────────────────────────────┘
  
  es = new EventSource(`${API_BASE_URL}/api/events`);
}
```

## Data Flow Comparison

### SSE Mode (Browser)
```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│ Agent   │───▶│ API     │───▶│ Redis   │───▶│ SSE      │
│ Command │    │ Endpoint│    │ Save    │    │ Broadcast│
└─────────┘    └─────────┘    └─────────┘    └────┬─────┘
                                                    │
                                                    │ Instant
                                                    ▼
                                              ┌──────────┐
                                              │ Frontend │
                                              │ Update   │
                                              └──────────┘
```

### Polling Mode (Meet Add-on)
```
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Agent   │───▶│ API     │───▶│ Redis   │
│ Command │    │ Endpoint│    │ Save    │
└─────────┘    └─────────┘    └─────────┘
                                    ▲
                                    │
                                    │ Poll every 2s
                                    │
                              ┌──────────┐
                              │ Frontend │
                              │ Polling  │
                              └──────────┘
```

## Why This Solution Works

### ✅ Advantages

1. **Automatic** - No configuration needed
2. **Universal** - Works in both contexts
3. **Efficient** - Only polls when necessary
4. **Reliable** - Fallback for CSP restrictions
5. **Visual** - Status badge shows mode
6. **Persistent** - Redis ensures data survives

### 📊 Performance

| Metric | SSE Mode | Polling Mode |
|--------|----------|--------------|
| Update Latency | ~25ms | 0-2000ms |
| Network Overhead | Low | Medium |
| Battery Impact | Minimal | Slightly higher |
| Compatibility | Browser only | Universal |
| Reliability | High | High |

## Security Considerations

### SSE Mode
- ✅ CORS headers configured
- ✅ Same-origin policy respected
- ✅ No authentication needed (public board)

### Polling Mode
- ✅ Standard HTTP requests
- ✅ Works with CSP restrictions
- ✅ No special permissions needed

## Monitoring

### Browser Console Logs

**SSE Mode:**
```
🔌 Using SSE mode (regular browser)
🔌 Connecting to SSE: https://board-v25.vercel.app/api/events
✅ Connected to SSE
💓 SSE heartbeat: 2024-10-31T12:00:00.000Z
📦 Raw SSE event received
✅ Adding new item to state
```

**Polling Mode:**
```
🔄 Using polling mode (Meet Add-on detected)
📦 Polling detected 1 new items
✅ Adding 1 new items from polling
🎯 Auto-focusing on new item: item-123
```

## Summary

The dual-mode architecture ensures real-time updates work everywhere:

- **Browser**: Uses SSE for instant updates (25ms latency)
- **Meet Add-on**: Uses polling for reliable updates (max 2s latency)

Both modes save to Redis for persistence and automatically focus on new items.
