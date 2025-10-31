# Migration Guide: Global Board → Session-Based Boards

## Quick Start

### 1. Install Dependencies

```bash
npm install uuid
```

### 2. Update package.json Scripts

Add a new script to use the session-based server:

```json
{
  "scripts": {
    "server-sessions": "node api/server-redis-sessions.js",
    "dev-sessions": "concurrently \"npm run server-sessions\" \"npm start\""
  }
}
```

### 3. Test the Session-Based Server

```bash
# Start the session-based server
npm run dev-sessions
```

### 4. Test with curl

```bash
# Create a new session
curl http://localhost:3001/api/session

# Response will include sessionId:
# {
#   "sessionId": "550e8400-e29b-41d4-a716-446655440000",
#   "itemCount": 10,
#   ...
# }

# Use the sessionId in subsequent requests
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "title": "Test Todo",
    "todo_items": ["Item 1", "Item 2"]
  }'
```

## Frontend Integration

### Option 1: Simple Session Management (Recommended for Testing)

Update `src/App.tsx`:

```typescript
// Add at the top of BoardApp component
const [sessionId, setSessionId] = useState<string | null>(null);

// Initialize session on mount
useEffect(() => {
  const initSession = async () => {
    // Check localStorage first
    let storedSessionId = localStorage.getItem('boardSessionId');
    
    if (!storedSessionId) {
      // Create new session
      const response = await fetch(`${API_BASE_URL}/api/session`);
      const data = await response.json();
      storedSessionId = data.sessionId;
      localStorage.setItem('boardSessionId', storedSessionId);
    }
    
    setSessionId(storedSessionId);
    console.log('📋 Using session:', storedSessionId);
  };
  
  initSession();
}, [API_BASE_URL]);

// Update all fetch calls to include session ID
const loadItemsFromBothSources = async () => {
  if (!sessionId) return;
  
  try {
    const apiUrl = `${API_BASE_URL}/api/board-items?sessionId=${sessionId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    setItems(data.items || []);
  } catch (error) {
    console.error('Error loading items:', error);
  }
};

// Update SSE connection
const sseUrl = `${API_BASE_URL}/api/events?sessionId=${sessionId}`;
es = new EventSource(sseUrl);
```

### Option 2: Meet-Based Session Management (For Google Meet Add-on)

Update `src/components/MeetSidePanel.tsx`:

```typescript
const getMeetingSessionId = () => {
  const meetUrl = window.location.href;
  const meetCode = meetUrl.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/)?.[1];
  
  if (meetCode) {
    return `meet-${meetCode}`;
  }
  
  return localStorage.getItem('boardSessionId') || null;
};

const handleJoinAgent = async () => {
  const sessionId = getMeetingSessionId();
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      meetUrl: targetMeetingUrl,
      sessionId: sessionId  // Pass to agent
    })
  });
};
```

## Agent Integration

### Update Agent to Accept Session ID

Your external agent needs to:

1. **Receive session ID** when joining a meeting
2. **Store it** for the duration of the session
3. **Include it** in all API calls

### Example: Python Agent

```python
class MeetingAgent:
    def __init__(self, board_api_url):
        self.board_api_url = board_api_url
        self.session_id = None
    
    def join_meeting(self, meet_url, session_id):
        """Called when agent joins a meeting"""
        self.session_id = session_id
        print(f"Agent joined meeting with session: {session_id}")
    
    def create_board_item(self, item_type, data):
        """Create an item on the board"""
        if not self.session_id:
            raise Exception("No active session")
        
        headers = {
            'Content-Type': 'application/json',
            'X-Session-Id': self.session_id
        }
        
        response = requests.post(
            f'{self.board_api_url}/api/{item_type}',
            headers=headers,
            json=data
        )
        
        return response.json()

# Usage
agent = MeetingAgent('https://your-app.vercel.app')

# When joining meeting, receive session ID from frontend
agent.join_meeting(
    meet_url='https://meet.google.com/abc-defg-hij',
    session_id='meet-abc-defg-hij'  # From frontend
)

# Now all API calls will use this session
agent.create_board_item('todos', {
    'title': 'Patient Tasks',
    'todo_items': ['Check vitals', 'Review labs']
})
```

### Example: Node.js Agent

```javascript
class MeetingAgent {
  constructor(boardApiUrl) {
    this.boardApiUrl = boardApiUrl;
    this.sessionId = null;
  }
  
  joinMeeting(meetUrl, sessionId) {
    this.sessionId = sessionId;
    console.log(`Agent joined meeting with session: ${sessionId}`);
  }
  
  async createBoardItem(itemType, data) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    const response = await fetch(`${this.boardApiUrl}/api/${itemType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': this.sessionId
      },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }
}

// Usage
const agent = new MeetingAgent('https://your-app.vercel.app');

// When joining meeting
agent.joinMeeting(
  'https://meet.google.com/abc-defg-hij',
  'meet-abc-defg-hij'
);

// Create items
await agent.createBoardItem('todos', {
  title: 'Patient Tasks',
  todo_items: ['Check vitals', 'Review labs']
});
```

## Testing Multiple Sessions

### Terminal 1: Session A
```bash
# Create session A
SESSION_A=$(curl -s http://localhost:3001/api/session | jq -r '.sessionId')
echo "Session A: $SESSION_A"

# Add item to session A
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_A" \
  -d '{"title": "Session A Todo", "todo_items": ["Task 1"]}'

# Get items from session A
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_A"
```

### Terminal 2: Session B
```bash
# Create session B
SESSION_B=$(curl -s http://localhost:3001/api/session | jq -r '.sessionId')
echo "Session B: $SESSION_B"

# Add item to session B
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_B" \
  -d '{"title": "Session B Todo", "todo_items": ["Task 1"]}'

# Get items from session B
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_B"
```

### Verify Isolation
```bash
# Session A should only have its own items
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_A" | jq '.items | length'

# Session B should only have its own items
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_B" | jq '.items | length'
```

## Deployment

### Vercel Deployment

1. Update `vercel.json` to use the session-based server:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/server-redis-sessions.js"
    }
  ]
}
```

2. Ensure environment variables are set:
```bash
vercel env add REDIS_URL
```

3. Deploy:
```bash
vercel --prod
```

## Rollback Plan

If you need to rollback to the global board:

1. Change the server script back:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run server-redis\" \"npm start\""
  }
}
```

2. Revert frontend changes (remove session management)

3. Redeploy

## Benefits of Session-Based Approach

✅ **Isolation**: Each meeting/user has their own board
✅ **Scalability**: Support multiple concurrent meetings
✅ **Security**: Sessions can't interfere with each other
✅ **Flexibility**: Works with all deployment scenarios
✅ **Agent Support**: External agents can target specific sessions

## Common Issues

### Issue: "Session not found"

**Solution**: Ensure session ID is being passed correctly in headers, query params, or body.

### Issue: Items not appearing

**Solution**: Verify frontend and agent are using the same session ID.

### Issue: SSE not working

**Solution**: Include session ID in SSE connection URL:
```javascript
const es = new EventSource(`${API_URL}/api/events?sessionId=${sessionId}`);
```

## Next Steps

1. ✅ Install `uuid` package
2. ✅ Test session-based server locally
3. ⬜ Update frontend to manage sessions
4. ⬜ Update agent to accept session ID
5. ⬜ Test with multiple concurrent sessions
6. ⬜ Deploy to production
7. ⬜ Monitor session usage and cleanup

## Support

For questions or issues, refer to:
- `documenatation/SESSION_BASED_BOARDS.md` - Full documentation
- `api/server-redis-sessions.js` - Implementation reference
