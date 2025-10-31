# Session-Based Board Flow Diagram

## Complete Flow: From Meeting Join to Board Update

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STEP 1: Meeting Starts                          │
└─────────────────────────────────────────────────────────────────────────┘

User opens Google Meet: https://meet.google.com/abc-defg-hij
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: Meet Add-on Loads                            │
└─────────────────────────────────────────────────────────────────────────┘

MeetSidePanel.tsx extracts meeting code:
  const meetCode = 'abc-defg-hij'
  const sessionId = `meet-${meetCode}`  // "meet-abc-defg-hij"
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  STEP 3: Frontend Initializes Session                   │
└─────────────────────────────────────────────────────────────────────────┘

App.tsx:
  1. Check URL params: ?sessionId=meet-abc-defg-hij
  2. If not found, check localStorage
  3. If not found, create new session
  4. Store in localStorage + URL
  5. Connect to SSE with session ID
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 4: Load Board Items                             │
└─────────────────────────────────────────────────────────────────────────┘

GET /api/board-items?sessionId=meet-abc-defg-hij
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │   API Server Middleware   │
                    │  - Extract session ID     │
                    │  - Attach to request      │
                    └───────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │   Storage Layer           │
                    │  Redis: boardItems:       │
                    │    meet-abc-defg-hij      │
                    └───────────────────────────┘
                                    │
                                    ▼
                    Returns items for this session only
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 5: User Joins AI Agent                          │
└─────────────────────────────────────────────────────────────────────────┘

User clicks "Join AI Agent" button
                                    │
                                    ▼
MeetSidePanel.tsx sends request:
  POST https://api.medforce-ai.com/join-meeting
  Body: {
    meetUrl: "https://meet.google.com/abc-defg-hij",
    sessionId: "meet-abc-defg-hij"  ← CRITICAL: Pass session ID
  }
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 6: Agent Joins Meeting                          │
└─────────────────────────────────────────────────────────────────────────┘

External Agent (Python/Node):
  1. Receives join request with sessionId
  2. Stores sessionId for this meeting
  3. Joins Google Meet audio/video
  4. Starts listening to conversation
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                STEP 7: Agent Analyzes and Creates Items                 │
└─────────────────────────────────────────────────────────────────────────┘

Agent hears: "We need to check the patient's lab results"
                                    │
                                    ▼
Agent creates TODO:
  POST https://your-app.vercel.app/api/todos
  Headers: {
    X-Session-Id: "meet-abc-defg-hij"  ← Uses stored session ID
  }
  Body: {
    title: "Action Items",
    todo_items: ["Check lab results", "Review with doctor"]
  }
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 8: API Processes Request                        │
└─────────────────────────────────────────────────────────────────────────┘

API Server (server-redis-sessions.js):
  1. Extract session ID from header: "meet-abc-defg-hij"
  2. Load existing items for THIS session
  3. Calculate position in Task Zone
  4. Create new TODO item
  5. Save to Redis: boardItems:meet-abc-defg-hij
  6. Broadcast SSE event to THIS session only
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 9: Frontend Receives Update                     │
└─────────────────────────────────────────────────────────────────────────┘

SSE Connection (session-specific):
  EventSource: /api/events?sessionId=meet-abc-defg-hij
                                    │
                                    ▼
  Receives event: "new-item"
  Data: {
    item: { id: "item-123", type: "todo", ... }
  }
                                    │
                                    ▼
App.tsx:
  1. Add item to state
  2. Render on canvas
  3. Auto-focus on new item
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 10: User Sees Update                            │
└─────────────────────────────────────────────────────────────────────────┘

User sees new TODO appear on board in real-time
Board automatically pans to show the new item
                                    │
                                    ▼
                            ✅ Complete!
```

## Parallel Session Example

```
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│      Meeting A (Session A)       │  │      Meeting B (Session B)       │
│  meet.google.com/abc-defg-hij    │  │  meet.google.com/xyz-uvwx-rst    │
└──────────────────────────────────┘  └──────────────────────────────────┘
              │                                      │
              │ sessionId: meet-abc-defg-hij         │ sessionId: meet-xyz-uvwx-rst
              │                                      │
              ▼                                      ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│     Frontend A                   │  │     Frontend B                   │
│  - Loads items for Session A     │  │  - Loads items for Session B     │
│  - SSE: /api/events?sessionId=A  │  │  - SSE: /api/events?sessionId=B  │
└──────────────────────────────────┘  └──────────────────────────────────┘
              │                                      │
              ▼                                      ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│     Agent A                      │  │     Agent B                      │
│  - Joins Meeting A               │  │  - Joins Meeting B               │
│  - Uses sessionId: A             │  │  - Uses sessionId: B             │
│  - Creates items in Session A    │  │  - Creates items in Session B    │
└──────────────────────────────────┘  └──────────────────────────────────┘
              │                                      │
              ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           API Server                                      │
│  ┌────────────────────────┐        ┌────────────────────────┐           │
│  │  Session A Handler     │        │  Session B Handler     │           │
│  │  - Routes to Storage A │        │  - Routes to Storage B │           │
│  │  - Broadcasts to SSE A │        │  - Broadcasts to SSE B │           │
│  └────────────────────────┘        └────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────┘
              │                                      │
              ▼                                      ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  Redis Storage                   │  │  Redis Storage                   │
│  boardItems:meet-abc-defg-hij    │  │  boardItems:meet-xyz-uvwx-rst    │
│  [items for Meeting A]           │  │  [items for Meeting B]           │
└──────────────────────────────────┘  └──────────────────────────────────┘

                    ✅ Complete Isolation ✅
```

## Session ID Flow Detail

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    How Session ID Flows Through System                  │
└─────────────────────────────────────────────────────────────────────────┘

1. CREATION
   ┌──────────────────────────────────────────────────────────────┐
   │ Option A: Auto-generated                                     │
   │   GET /api/session                                           │
   │   → Server generates UUID                                    │
   │   → Returns: { sessionId: "550e8400-..." }                   │
   │                                                              │
   │ Option B: Meeting-based                                      │
   │   const meetCode = extractFromUrl()  // "abc-defg-hij"      │
   │   const sessionId = `meet-${meetCode}`                       │
   │   → "meet-abc-defg-hij"                                      │
   │                                                              │
   │ Option C: Custom                                             │
   │   const sessionId = "my-custom-id"                           │
   │   GET /api/session?sessionId=my-custom-id                    │
   └──────────────────────────────────────────────────────────────┘

2. STORAGE
   ┌──────────────────────────────────────────────────────────────┐
   │ Frontend:                                                    │
   │   localStorage.setItem('boardSessionId', sessionId)          │
   │   URL: ?sessionId=meet-abc-defg-hij                          │
   │                                                              │
   │ Agent:                                                       │
   │   this.sessionId = sessionId  // Store in instance           │
   └──────────────────────────────────────────────────────────────┘

3. TRANSMISSION
   ┌──────────────────────────────────────────────────────────────┐
   │ Method 1: HTTP Header (Recommended)                          │
   │   headers: { 'X-Session-Id': sessionId }                     │
   │                                                              │
   │ Method 2: Query Parameter                                    │
   │   /api/board-items?sessionId=meet-abc-defg-hij               │
   │                                                              │
   │ Method 3: Request Body                                       │
   │   body: { sessionId: 'meet-abc-defg-hij', ... }              │
   └──────────────────────────────────────────────────────────────┘

4. EXTRACTION (Server-side)
   ┌──────────────────────────────────────────────────────────────┐
   │ Middleware checks in order:                                  │
   │   1. req.headers['x-session-id']                             │
   │   2. req.query.sessionId                                     │
   │   3. req.body.sessionId                                      │
   │   4. If none found, generate new UUID                        │
   │                                                              │
   │ Result: req.sessionId = 'meet-abc-defg-hij'                  │
   └──────────────────────────────────────────────────────────────┘

5. USAGE (Server-side)
   ┌──────────────────────────────────────────────────────────────┐
   │ Load items:                                                  │
   │   const key = `boardItems:${req.sessionId}`                  │
   │   const items = await redis.get(key)                         │
   │                                                              │
   │ Save items:                                                  │
   │   const key = `boardItems:${req.sessionId}`                  │
   │   await redis.set(key, JSON.stringify(items))                │
   │                                                              │
   │ Broadcast SSE:                                               │
   │   const clients = sseClientsBySession.get(req.sessionId)     │
   │   clients.forEach(client => client.write(...))               │
   └──────────────────────────────────────────────────────────────┘

6. RESPONSE
   ┌──────────────────────────────────────────────────────────────┐
   │ Server includes session ID in response:                      │
   │   res.setHeader('X-Session-Id', sessionId)                   │
   │   res.json({ sessionId, items, ... })                        │
   │                                                              │
   │ Frontend can verify:                                         │
   │   const returnedSessionId = response.headers.get('X-Session-Id')│
   └──────────────────────────────────────────────────────────────┘
```

## Error Scenarios

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Common Error Scenarios                          │
└─────────────────────────────────────────────────────────────────────────┘

❌ SCENARIO 1: Agent uses wrong session ID
   Agent: sessionId = "wrong-id"
   Frontend: sessionId = "meet-abc-defg-hij"
   
   Result: Agent creates items in "wrong-id" session
           Frontend doesn't see them
   
   Fix: Ensure agent receives correct session ID from frontend

❌ SCENARIO 2: Frontend doesn't pass session ID to agent
   Frontend: sessionId = "meet-abc-defg-hij"
   Agent: No session ID provided
   
   Result: Agent creates new session, items appear in wrong board
   
   Fix: Include sessionId in join-meeting request

❌ SCENARIO 3: SSE connected to wrong session
   Frontend: sessionId = "meet-abc-defg-hij"
   SSE: /api/events?sessionId=different-id
   
   Result: Frontend doesn't receive updates
   
   Fix: Ensure SSE URL includes correct session ID

✅ CORRECT FLOW:
   1. Frontend creates/gets session ID
   2. Frontend passes session ID to agent when joining
   3. Agent stores and uses session ID in all requests
   4. Frontend connects SSE with same session ID
   5. All updates flow through correct session
```

## Visual Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Session Isolation                               │
└─────────────────────────────────────────────────────────────────────────┘

WITHOUT SESSIONS (Current - Global Board):
┌──────────────────────────────────────────────────────────────────────────┐
│                          Single Board State                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Meeting A  │  │ Meeting B  │  │ Meeting C  │  │ Meeting D  │        │
│  │  Users     │  │  Users     │  │  Users     │  │  Users     │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
│        │                │                │                │               │
│        └────────────────┴────────────────┴────────────────┘               │
│                              │                                            │
│                              ▼                                            │
│                    ┌──────────────────┐                                  │
│                    │  Global Board    │                                  │
│                    │  [All Items]     │                                  │
│                    └──────────────────┘                                  │
│                                                                           │
│  ❌ Problem: All meetings see the same items                             │
│  ❌ Changes affect everyone                                              │
└──────────────────────────────────────────────────────────────────────────┘

WITH SESSIONS (New - Isolated Boards):
┌──────────────────────────────────────────────────────────────────────────┐
│                        Isolated Board States                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Meeting A  │  │ Meeting B  │  │ Meeting C  │  │ Meeting D  │        │
│  │  Users     │  │  Users     │  │  Users     │  │  Users     │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
│        │                │                │                │               │
│        ▼                ▼                ▼                ▼               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Board A  │    │ Board B  │    │ Board C  │    │ Board D  │          │
│  │ [Items A]│    │ [Items B]│    │ [Items C]│    │ [Items D]│          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│                                                                           │
│  ✅ Each meeting has its own board                                       │
│  ✅ Complete isolation                                                   │
│  ✅ Agents can target specific boards                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

**Ready to implement?** Follow the flow from top to bottom, ensuring session ID is passed at each step.
