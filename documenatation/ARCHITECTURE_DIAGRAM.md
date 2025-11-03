# Architecture Diagram - Real-Time Updates

## Overview

The application uses **Server-Sent Events (SSE)** for real-time updates across all clients, including Google Meet Add-ons.

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Frontend (React App)                        │
│              (Browser or Meet Add-on)                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  useEffect(() => {                             │    │
│  │    // Connect to SSE endpoint                  │    │
│  │    const es = new EventSource('/api/events');  │    │
│  │                                                 │    │
│  │    es.addEventListener('new-item', (event) => {│    │
│  │      const item = JSON.parse(event.data);      │    │
│  │      // Update UI instantly                    │    │
│  │    });                                         │    │
│  │  })                                            │    │
│  └────────────────┬───────────────────────────────┘    │
│                   │                                     │
│                   │ SSE Connection (persistent)         │
│                   │                                     │
└───────────────────┼─────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│              Backend API Server                          │
│              (Express + Redis)                           │
│                                                          │
│  SSE Endpoint: GET /api/events                          │
│  - Maintains persistent connection                       │
│  - Broadcasts events to all connected clients           │
│  - Session-aware (per session ID)                       │
│                                                          │
│  API Endpoints:                                         │
│  - POST /api/todos                                      │
│  - POST /api/agents                                     │
│  - POST /api/focus                                      │
│  - GET /api/board-items                                 │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│              Redis (Persistent Storage)                  │
│              - Board items per session                   │
│              - Session data                              │
│              - TTL: 24 hours                            │
└──────────────────────────────────────────────────────────┘
```

## Real-Time Update Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│ Agent   │───▶│ API     │───▶│ Redis   │───▶│ SSE      │
│ Command │    │ Endpoint│    │ Save    │    │ Broadcast│
└─────────┘    └─────────┘    └─────────┘    └────┬─────┘
                                                    │
                                                    │ Instant
                                                    ▼
                                              ┌──────────┐
                                              │ All      │
                                              │ Clients  │
                                              └──────────┘
```

## Timeline

```
─────────────────────────────────────────────────────────────
0ms:    Agent calls API
10ms:   Redis saves item
15ms:   SSE broadcasts to all clients
25ms:   All clients receive update
30ms:   UI updates
─────────────────────────────────────────────────────────────
Total: ~30ms (real-time)
```

## Session-Based Architecture

Each session has its own:
- Board items in Redis (`boardItems:{sessionId}`)
- SSE client connections
- Isolated state

```typescript
// Session ID from URL, header, or auto-generated
const sessionId = req.query.sessionId || req.headers['x-session-id'] || uuidv4();

// Load items for this session only
const items = await loadBoardItems(sessionId);

// Broadcast to this session only
broadcastSSE(sessionId, { event: 'new-item', item });
```

## Why SSE Works

### ✅ Advantages

1. **Real-time** - Instant updates (~25ms latency)
2. **Efficient** - Single persistent connection
3. **Simple** - Native browser API
4. **Reliable** - Auto-reconnection built-in
5. **Session-aware** - Isolated per session
6. **Persistent** - Redis ensures data survives

### 📊 Performance

| Metric | Value |
|--------|-------|
| Update Latency | ~25ms |
| Network Overhead | Low |
| Battery Impact | Minimal |
| Compatibility | All modern browsers |
| Reliability | High |

## Security Considerations

- ✅ CORS headers configured
- ✅ Session isolation
- ✅ Redis TTL prevents data accumulation
- ✅ Frame-ancestors policy for Meet Add-ons

## Monitoring

### Browser Console Logs

```
🔌 Using SSE mode
🔌 Connecting to SSE: https://board-v25.vercel.app/api/events
✅ Connected to SSE for session: abc-123
💓 SSE heartbeat: 2024-10-31T12:00:00.000Z
📦 Raw SSE event received
✅ Adding new item to state
🎯 Auto-focusing on new item: item-123
```

## Summary

The application uses Server-Sent Events (SSE) for real-time updates across all clients:

- **Instant updates**: ~25ms latency
- **Session-aware**: Isolated per session
- **Persistent**: Redis storage with 24h TTL
- **Auto-focus**: New items automatically centered
- **Universal**: Works in browsers and Meet Add-ons
