# Session-Based Board Implementation

## Overview

The session-based board system allows each user/meeting to have their own isolated board state. This prevents changes from one session affecting another, while still allowing external agents to interact with specific sessions.

## Key Concepts

### Session ID

- A unique identifier (UUID) for each board session
- Generated automatically on first connection
- Must be included in all API requests to interact with a specific board

### Storage

- **Redis**: Persistent storage with session namespacing (`boardItems:sessionId`)
- **In-Memory**: Fallback when Redis is unavailable
- **Expiration**: Sessions expire after 24 hours of inactivity (Redis only)

### SSE (Server-Sent Events)

- Each session has its own SSE channel
- Updates are broadcast only to clients in the same session
- Prevents cross-session data leakage

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     External Agent                          │
│  (Must include sessionId in API calls)                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ POST /api/todos?sessionId=abc-123
                 │ X-Session-Id: abc-123
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Server (Express)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Session Middleware                                   │  │
│  │  - Extracts sessionId from header/query/body         │  │
│  │  - Creates new session if none provided              │  │
│  │  - Attaches sessionId to request                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Storage Layer                                        │  │
│  │  Redis: boardItems:abc-123 → [items]                 │  │
│  │  Redis: boardItems:xyz-789 → [items]                 │  │
│  │  Memory: Map<sessionId, items[]>                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SSE Broadcast                                        │  │
│  │  Session abc-123: [client1, client2]                 │  │
│  │  Session xyz-789: [client3]                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                 │
                 │ SSE: event: new-item
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend Clients (Same Session)                 │
│  - Localhost                                                 │
│  - Meet Add-on                                               │
│  - Deployed App                                              │
└─────────────────────────────────────────────────────────────┘
```

## API Usage

### 1. Creating a New Session

**Option A: Let the server create a session**

```bash
curl http://localhost:3001/api/session
```

Response:

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "itemCount": 10,
  "createdAt": "2024-10-31T10:00:00.000Z",
  "connectedClients": 0
}
```

**Option B: Provide your own session ID**

```bash
curl -H "X-Session-Id: my-meeting-123" http://localhost:3001/api/session
```

### 2. External Agent Making API Calls

External agents MUST include the session ID in one of three ways:

**Method 1: HTTP Header (Recommended)**

```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "title": "Review Lab Results",
    "description": "Check patient vitals",
    "todo_items": ["Check BP", "Review glucose levels"]
  }'
```

**Method 2: Query Parameter**

```bash
curl -X POST "http://localhost:3001/api/todos?sessionId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review Lab Results",
    "todo_items": ["Check BP", "Review glucose levels"]
  }'
```

**Method 3: Request Body**

```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Review Lab Results",
    "todo_items": ["Check BP", "Review glucose levels"]
  }'
```

### 3. Frontend Connecting to Session

The frontend needs to:

1. Get or create a session ID
2. Store it (localStorage, URL param, or state)
3. Include it in all API calls
4. Connect to SSE with the session ID

**Example Frontend Code:**

```javascript
// Get or create session ID
let sessionId = localStorage.getItem("boardSessionId");

if (!sessionId) {
  // Create new session
  const response = await fetch("http://localhost:3001/api/session");
  const data = await response.json();
  sessionId = data.sessionId;
  localStorage.setItem("boardSessionId", sessionId);
}

// Connect to SSE with session ID
const eventSource = new EventSource(
  `http://localhost:3001/api/events?sessionId=${sessionId}`
);

eventSource.addEventListener("connected", (event) => {
  const data = JSON.parse(event.data);
  console.log("Connected to session:", data.sessionId);
});

eventSource.addEventListener("new-item", (event) => {
  const data = JSON.parse(event.data);
  console.log("New item added:", data.item);
  // Update UI with new item
});

// Load board items for this session
const loadItems = async () => {
  const response = await fetch(
    `http://localhost:3001/api/board-items?sessionId=${sessionId}`
  );
  const data = await response.json();
  console.log("Loaded items:", data.items);
};
```

### 4. Google Meet Add-on Integration

For Google Meet, the session ID should be derived from the meeting URL:

```javascript
// In MeetSidePanel.tsx
const getMeetingSessionId = () => {
  const meetUrl = window.location.href;
  const meetCode = meetUrl.match(
    /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/
  )?.[1];

  if (meetCode) {
    // Use meeting code as session ID
    return `meet-${meetCode}`;
  }

  // Fallback to localStorage
  return localStorage.getItem("boardSessionId") || null;
};

const sessionId = getMeetingSessionId();

// Pass to agent when joining
const handleJoinAgent = async () => {
  const response = await fetch("https://api.medforce-ai.com/join-meeting", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meetUrl: meetingUrl,
      sessionId: sessionId, // Include session ID
    }),
  });
};
```

### 5. Agent Implementation Example

External agents should:

1. Receive session ID when joining a meeting
2. Store it for the duration of the session
3. Include it in all API calls

```python
# Python agent example
import requests
import json

class BoardAgent:
    def __init__(self, api_base_url, session_id):
        self.api_base_url = api_base_url
        self.session_id = session_id
        self.headers = {
            'Content-Type': 'application/json',
            'X-Session-Id': session_id
        }

    def create_todo(self, title, items):
        """Create a todo item on the board"""
        response = requests.post(
            f'{self.api_base_url}/api/todos',
            headers=self.headers,
            json={
                'title': title,
                'todo_items': items
            }
        )
        return response.json()

    def create_agent_note(self, title, content, zone='task-management-zone'):
        """Create an agent note on the board"""
        response = requests.post(
            f'{self.api_base_url}/api/agents',
            headers=self.headers,
            json={
                'title': title,
                'content': content,
                'zone': zone
            }
        )
        return response.json()

    def focus_on_item(self, item_id):
        """Focus the board on a specific item"""
        response = requests.post(
            f'{self.api_base_url}/api/focus',
            headers=self.headers,
            json={
                'itemId': item_id
            }
        )
        return response.json()

# Usage
agent = BoardAgent(
    api_base_url='https://your-app.vercel.app',
    session_id='meet-abc-defg-hij'  # From meeting join request
)

# Create items on the board
result = agent.create_todo(
    title='Patient Assessment Tasks',
    items=['Check vitals', 'Review medications', 'Update chart']
)

print(f"Created todo: {result['item']['id']}")

# Focus on the new item
agent.focus_on_item(result['item']['id'])
```

## Session Management

### Session Lifecycle

1. **Creation**: Automatically created on first API call without session ID
2. **Active**: Session is active while clients are connected or API calls are made
3. **Expiration**: Redis sessions expire after 24 hours of inactivity
4. **Cleanup**: In-memory sessions are cleared when all clients disconnect

### Clearing a Session

```bash
curl -X DELETE http://localhost:3001/api/session \
  -H "X-Session-Id: 550e8400-e29b-41d4-a716-446655440000"
```

### Listing Active Sessions

```bash
curl http://localhost:3001/api/health
```

Response includes active sessions:

```json
{
  "status": "OK",
  "storage": "redis (persistent)",
  "activeSessions": "3 (+ Redis sessions)",
  "sseConnections": [
    {
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "clients": 2
    },
    {
      "sessionId": "meet-abc-defg-hij",
      "clients": 1
    }
  ]
}
```

## Migration from Global Board

### Backend Changes

1. Replace `api/server-redis.js` with `api/server-redis-sessions.js`
2. Update `package.json` to use the new file
3. Add `uuid` package: `npm install uuid`

### Frontend Changes

1. Add session management to `App.tsx`:

   - Get/create session ID on mount
   - Store in localStorage or URL
   - Include in all API calls

2. Update SSE connection to include session ID

3. For Meet Add-on: Derive session ID from meeting URL

### Agent Changes

1. Update agent to receive session ID when joining meeting
2. Store session ID for the duration of the session
3. Include session ID in all API requests

## Benefits

✅ **Isolation**: Each session has its own board state
✅ **Scalability**: Multiple meetings can run simultaneously
✅ **Security**: Sessions can't interfere with each other
✅ **Flexibility**: Works with localhost, deployed apps, and Meet Add-ons
✅ **Agent Support**: External agents can target specific sessions
✅ **Automatic Cleanup**: Sessions expire after 24 hours

## Troubleshooting

### Issue: Items appearing in wrong session

**Cause**: Session ID not being passed correctly

**Solution**: Verify session ID is included in:

- HTTP headers: `X-Session-Id`
- Query params: `?sessionId=...`
- Request body: `{ "sessionId": "..." }`

### Issue: Agent can't find session

**Cause**: Session ID mismatch between frontend and agent

**Solution**:

1. Frontend should pass session ID to agent when requesting join
2. Agent should store and use the same session ID
3. Verify session exists: `GET /api/session?sessionId=...`

### Issue: SSE not receiving updates

**Cause**: SSE connected to different session

**Solution**: Ensure SSE URL includes correct session ID:

```javascript
const eventSource = new EventSource(
  `${API_URL}/api/events?sessionId=${sessionId}`
);
```

## Next Steps

1. Implement session management in frontend
2. Update agent to accept and use session ID
3. Test with multiple concurrent sessions
4. Add session sharing/collaboration features (optional)
