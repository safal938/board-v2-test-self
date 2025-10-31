# Session-Based Boards - Quick Reference

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install uuid

# 2. Start session-based server
node api/server-redis-sessions.js

# 3. Test it
curl http://localhost:3001/api/session
```

## 📋 Session ID Methods

### Method 1: HTTP Header (Recommended)
```bash
curl -H "X-Session-Id: abc-123" http://localhost:3001/api/board-items
```

### Method 2: Query Parameter
```bash
curl "http://localhost:3001/api/board-items?sessionId=abc-123"
```

### Method 3: Request Body
```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "abc-123", "title": "Task", "todo_items": ["Item 1"]}'
```

## 🔑 Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | GET | Get/create session info |
| `/api/board-items` | GET | Get items for session |
| `/api/todos` | POST | Create TODO (session-aware) |
| `/api/agents` | POST | Create agent note (session-aware) |
| `/api/focus` | POST | Focus on item (session-aware) |
| `/api/events` | GET | SSE stream (session-aware) |
| `/api/session` | DELETE | Clear session data |

## 💻 Frontend Integration

### Get/Create Session
```javascript
// Get or create session
const response = await fetch('http://localhost:3001/api/session');
const { sessionId } = await response.json();

// Store it
localStorage.setItem('boardSessionId', sessionId);
```

### Connect to SSE
```javascript
const sessionId = localStorage.getItem('boardSessionId');
const eventSource = new EventSource(
  `http://localhost:3001/api/events?sessionId=${sessionId}`
);

eventSource.addEventListener('new-item', (event) => {
  const data = JSON.parse(event.data);
  console.log('New item:', data.item);
});
```

### Make API Calls
```javascript
const sessionId = localStorage.getItem('boardSessionId');

const response = await fetch('http://localhost:3001/api/todos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-Id': sessionId
  },
  body: JSON.stringify({
    title: 'My Tasks',
    todo_items: ['Task 1', 'Task 2']
  })
});
```

## 🤖 Agent Integration

### Python Example
```python
import requests

class BoardAgent:
    def __init__(self, api_url, session_id):
        self.api_url = api_url
        self.session_id = session_id
    
    def create_todo(self, title, items):
        response = requests.post(
            f'{self.api_url}/api/todos',
            headers={'X-Session-Id': self.session_id},
            json={'title': title, 'todo_items': items}
        )
        return response.json()

# Usage
agent = BoardAgent('https://your-app.vercel.app', 'meet-abc-defg-hij')
agent.create_todo('Tasks', ['Item 1', 'Item 2'])
```

### Node.js Example
```javascript
class BoardAgent {
  constructor(apiUrl, sessionId) {
    this.apiUrl = apiUrl;
    this.sessionId = sessionId;
  }
  
  async createTodo(title, items) {
    const response = await fetch(`${this.apiUrl}/api/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': this.sessionId
      },
      body: JSON.stringify({ title, todo_items: items })
    });
    return response.json();
  }
}

// Usage
const agent = new BoardAgent('https://your-app.vercel.app', 'meet-abc-defg-hij');
await agent.createTodo('Tasks', ['Item 1', 'Item 2']);
```

## 🎯 Google Meet Integration

### Derive Session from Meeting URL
```javascript
const getMeetingSessionId = () => {
  const meetUrl = window.location.href;
  const meetCode = meetUrl.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/)?.[1];
  
  if (meetCode) {
    return `meet-${meetCode}`;
  }
  
  return localStorage.getItem('boardSessionId');
};

const sessionId = getMeetingSessionId();
```

### Pass to Agent
```javascript
const handleJoinAgent = async () => {
  const sessionId = getMeetingSessionId();
  
  await fetch('https://api.medforce-ai.com/join-meeting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meetUrl: meetingUrl,
      sessionId: sessionId  // Agent will use this
    })
  });
};
```

## 🧪 Testing

### Test Session Isolation
```bash
# Run the test script
node test-sessions.js
```

### Manual Testing
```bash
# Session A
SESSION_A=$(curl -s http://localhost:3001/api/session | jq -r '.sessionId')
curl -X POST http://localhost:3001/api/todos \
  -H "X-Session-Id: $SESSION_A" \
  -H "Content-Type: application/json" \
  -d '{"title": "Session A", "todo_items": ["Task A"]}'

# Session B
SESSION_B=$(curl -s http://localhost:3001/api/session | jq -r '.sessionId')
curl -X POST http://localhost:3001/api/todos \
  -H "X-Session-Id: $SESSION_B" \
  -H "Content-Type: application/json" \
  -d '{"title": "Session B", "todo_items": ["Task B"]}'

# Verify isolation
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_A" | jq '.items | length'
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_B" | jq '.items | length'
```

## 🗄️ Storage

### Redis (Persistent)
- Key format: `boardItems:sessionId`
- Expiration: 24 hours
- Shared across all instances

### In-Memory (Fallback)
- Map<sessionId, items[]>
- Per-instance only
- Cleared on restart

## 🔧 Configuration

### Environment Variables
```bash
# .env
REDIS_URL=redis://localhost:6379
PORT=3001
```

### Package.json Scripts
```json
{
  "scripts": {
    "server-sessions": "node api/server-redis-sessions.js",
    "dev-sessions": "concurrently \"npm run server-sessions\" \"npm start\"",
    "test-sessions": "node test-sessions.js"
  }
}
```

## 📊 Monitoring

### Check Active Sessions
```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "OK",
  "storage": "redis (persistent)",
  "activeSessions": "3 (+ Redis sessions)",
  "sseConnections": [
    {
      "sessionId": "abc-123",
      "clients": 2
    }
  ]
}
```

## 🚨 Troubleshooting

### Items not appearing?
✅ Check session ID is consistent across frontend and agent
✅ Verify session ID in API calls (header/query/body)
✅ Check browser console for session ID

### SSE not working?
✅ Include session ID in SSE URL: `/api/events?sessionId=...`
✅ Check browser network tab for SSE connection
✅ Verify session exists: `GET /api/session?sessionId=...`

### Agent can't find session?
✅ Frontend must pass session ID when agent joins
✅ Agent must store and use the same session ID
✅ Test with: `curl "http://localhost:3001/api/session?sessionId=..."`

## 📚 Full Documentation

- `documenatation/SESSION_BASED_BOARDS.md` - Complete guide
- `MIGRATION_TO_SESSIONS.md` - Migration steps
- `api/server-redis-sessions.js` - Implementation
- `test-sessions.js` - Test examples

## ✅ Checklist

- [ ] Install `uuid` package
- [ ] Test session-based server locally
- [ ] Update frontend to manage sessions
- [ ] Update agent to accept session ID
- [ ] Test with multiple concurrent sessions
- [ ] Deploy to production
- [ ] Monitor session usage

## 🎉 Benefits

✅ Each session has isolated board state
✅ Multiple meetings can run simultaneously
✅ External agents can target specific sessions
✅ Works with localhost, deployed apps, and Meet Add-ons
✅ Automatic session cleanup after 24 hours
