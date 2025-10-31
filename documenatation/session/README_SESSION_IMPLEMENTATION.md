# Session-Based Board Implementation

## 🎯 Problem Solved

Your collaborative board currently has **universal state** - when an external agent makes an API call, the changes appear on **everyone's board** (localhost, deployed app, Meet Add-on).

This implementation provides **session-based isolation** where each meeting/user has their own board, while still allowing external agents to target specific sessions.

## 📦 What's Included

### Core Files

- **`api/server-redis-sessions.js`** - Session-aware API server
- **`test-sessions.js`** - Automated test suite
- **`src/App-with-sessions.example.tsx`** - Frontend example

### Documentation

- **`SESSION_IMPLEMENTATION_SUMMARY.md`** - Overview and quick start
- **`SESSION_QUICK_REFERENCE.md`** - One-page cheat sheet
- **`SESSION_FLOW_DIAGRAM.md`** - Visual flow diagrams
- **`documenatation/SESSION_BASED_BOARDS.md`** - Complete guide
- **`MIGRATION_TO_SESSIONS.md`** - Step-by-step migration

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Session-Based Server

```bash
npm run server-sessions
```

### 3. Test It

```bash
# In another terminal
npm run test-sessions
```

You should see:

```
✅ Session isolation working correctly!
✅ Agent workflow complete!
✅ All tests completed successfully!
```

## 🔑 Key Concept

### Before (Global Board)

```
Agent API Call → Global Board → Everyone sees it
```

### After (Session-Based)

```
Agent API Call + Session ID → Session Board → Only that session sees it
```

## 💡 How It Works

### 1. Session Creation

```javascript
// Frontend creates or gets session ID
const response = await fetch("/api/session");
const { sessionId } = await response.json();
// sessionId: "550e8400-e29b-41d4-a716-446655440000"

// Store it
localStorage.setItem("boardSessionId", sessionId);
```

### 2. Agent Receives Session ID

```javascript
// When agent joins meeting, frontend passes session ID
await fetch("https://api.medforce-ai.com/join-meeting", {
  method: "POST",
  body: JSON.stringify({
    meetUrl: "https://meet.google.com/abc-defg-hij",
    sessionId: sessionId, // ← Critical!
  }),
});
```

### 3. Agent Uses Session ID

```python
# Agent stores session ID
class MeetingAgent:
    def __init__(self, api_url):
        self.api_url = api_url
        self.session_id = None

    def join_meeting(self, meet_url, session_id):
        self.session_id = session_id  # Store it

    def create_todo(self, title, items):
        # Include in all API calls
        response = requests.post(
            f'{self.api_url}/api/todos',
            headers={'X-Session-Id': self.session_id},
            json={'title': title, 'todo_items': items}
        )
        return response.json()
```

### 4. Updates Go to Correct Session

```
Agent creates TODO with session ID
    ↓
API routes to correct session storage
    ↓
SSE broadcasts to that session only
    ↓
Frontend receives update
    ↓
Board updates in real-time
```

## 📋 Implementation Checklist

### Backend

- [x] ✅ Session-aware API server created
- [x] ✅ Redis storage with session namespacing
- [x] ✅ SSE per-session broadcasting
- [x] ✅ Test suite created
- [ ] ⬜ Deploy to production

### Frontend

- [ ] ⬜ Add session management (see `src/App-with-sessions.example.tsx`)
- [ ] ⬜ Include session ID in API calls
- [ ] ⬜ Update SSE connection
- [ ] ⬜ Test with multiple sessions

### Agent

- [ ] ⬜ Accept session ID in join request
- [ ] ⬜ Store session ID
- [ ] ⬜ Include session ID in all API calls
- [ ] ⬜ Test with real meetings

## 🧪 Testing

### Automated Tests

```bash
npm run test-sessions
```

### Manual Testing

```bash
# Terminal 1: Create Session A
SESSION_A=$(curl -s http://localhost:3001/api/session | jq -r '.sessionId')
echo "Session A: $SESSION_A"

# Terminal 2: Create Session B
SESSION_B=$(curl -s http://localhost:3001/api/session | jq -r '.sessionId')
echo "Session B: $SESSION_B"

# Add item to Session A
curl -X POST http://localhost:3001/api/todos \
  -H "X-Session-Id: $SESSION_A" \
  -H "Content-Type: application/json" \
  -d '{"title": "Session A Todo", "todo_items": ["Task 1"]}'

# Add item to Session B
curl -X POST http://localhost:3001/api/todos \
  -H "X-Session-Id: $SESSION_B" \
  -H "Content-Type: application/json" \
  -d '{"title": "Session B Todo", "todo_items": ["Task 1"]}'

# Verify isolation
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_A" | jq '.items | map(.todoData.title)'
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_B" | jq '.items | map(.todoData.title)'
```

## 📚 Documentation Guide

Start here based on your needs:

| If you want to...      | Read this                                |
| ---------------------- | ---------------------------------------- |
| Understand the concept | `SESSION_IMPLEMENTATION_SUMMARY.md`      |
| Get started quickly    | `SESSION_QUICK_REFERENCE.md`             |
| See visual flows       | `SESSION_FLOW_DIAGRAM.md`                |
| Migrate existing code  | `MIGRATION_TO_SESSIONS.md`               |
| Deep dive into details | `documenatation/SESSION_BASED_BOARDS.md` |

## 🎯 Common Use Cases

### Use Case 1: Google Meet Integration

```javascript
// Derive session from meeting URL
const meetCode = "abc-defg-hij";
const sessionId = `meet-${meetCode}`;

// Pass to agent when joining
await fetch("https://api.medforce-ai.com/join-meeting", {
  method: "POST",
  body: JSON.stringify({
    meetUrl: `https://meet.google.com/${meetCode}`,
    sessionId: sessionId,
  }),
});
```

### Use Case 2: Multiple Concurrent Meetings

```
Meeting A (meet-abc-defg-hij) → Board A
Meeting B (meet-xyz-uvwx-rst) → Board B
Meeting C (meet-123-4567-890) → Board C

Each has isolated state, no interference
```

### Use Case 3: Development & Testing

```bash
# Developer 1: Working on feature A
SESSION_DEV1="dev-feature-a"

# Developer 2: Working on feature B
SESSION_DEV2="dev-feature-b"

# Each sees only their own changes
```

## 🔧 Configuration

### Environment Variables

```bash
# .env
REDIS_URL=redis://localhost:6379  # Optional, falls back to in-memory
PORT=3001
```

### Package.json Scripts

```json
{
  "server-sessions": "node api/server-redis-sessions.js",
  "dev-sessions": "concurrently \"npm run server-sessions\" \"npm start\"",
  "test-sessions": "node test-sessions.js"
}
```

## 🚨 Troubleshooting

### Items not appearing?

```bash
# Check session ID is consistent
curl "http://localhost:3001/api/session?sessionId=YOUR_SESSION_ID"

# Verify items exist in session
curl "http://localhost:3001/api/board-items?sessionId=YOUR_SESSION_ID" | jq '.items | length'
```

### Agent can't find session?

```bash
# Ensure agent received session ID
# Check agent logs for: "Joined session: YOUR_SESSION_ID"

# Verify agent is using correct session ID in API calls
# Check API logs for: "Session: YOUR_SESSION_ID"
```

### SSE not working?

```javascript
// Ensure SSE URL includes session ID
const eventSource = new EventSource(
  `${API_URL}/api/events?sessionId=${sessionId}`
);

// Check browser console for connection
eventSource.addEventListener("connected", (event) => {
  console.log("Connected:", event.data);
});
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
      "sessionId": "meet-abc-defg-hij",
      "clients": 2
    }
  ]
}
```

## 🎉 Benefits

### For Users

✅ Each meeting has its own board  
✅ No interference between sessions  
✅ Can share board via URL with session ID

### For Developers

✅ Clean separation of concerns  
✅ Easy to test with multiple sessions  
✅ Scalable architecture

### For Agents

✅ Can target specific sessions  
✅ Clear session lifecycle  
✅ Simple API integration

## 🚀 Next Steps

1. **Test Locally**

   ```bash
   npm run server-sessions
   npm run test-sessions
   ```

2. **Update Frontend**

   - Copy relevant code from `src/App-with-sessions.example.tsx`
   - Test with multiple browser tabs using different session IDs

3. **Update Agent**

   - Modify agent to accept session ID in join request
   - Store and use session ID in all API calls

4. **Deploy**

   - Update `vercel.json` to use session-based server
   - Deploy and test with real meetings

5. **Monitor**
   - Check `/api/health` for active sessions
   - Monitor Redis for session data
   - Set up alerts for session cleanup

## 📞 Support

For questions or issues:

1. Check `SESSION_QUICK_REFERENCE.md` for quick answers
2. Review `SESSION_FLOW_DIAGRAM.md` for visual understanding
3. Read `documenatation/SESSION_BASED_BOARDS.md` for details
4. Run `npm run test-sessions` to verify setup

## 🎓 Learning Path

1. **Understand the Problem** (5 min)

   - Read this README
   - Review `SESSION_IMPLEMENTATION_SUMMARY.md`

2. **See It in Action** (10 min)

   - Run `npm run server-sessions`
   - Run `npm run test-sessions`
   - Watch the isolation in action

3. **Understand the Flow** (15 min)

   - Read `SESSION_FLOW_DIAGRAM.md`
   - Follow the visual diagrams

4. **Implement** (30-60 min)

   - Update frontend using example
   - Update agent to use session ID
   - Test with multiple sessions

5. **Deploy** (15 min)
   - Update deployment config
   - Deploy to production
   - Test with real meetings

## ✅ Success Criteria

You'll know it's working when:

✅ Multiple sessions can run simultaneously  
✅ Items in one session don't appear in another  
✅ External agents can target specific sessions  
✅ SSE updates only go to relevant clients  
✅ Sessions work across localhost, deployed, and Meet Add-on  
✅ Automatic cleanup prevents storage bloat

---

**Ready to get started?**

```bash
npm install
npm run server-sessions
npm run test-sessions
```

Then follow the implementation checklist above!
