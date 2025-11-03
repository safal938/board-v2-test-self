# Session Security Fix - Session ID Now Required

## Problem

The API was auto-generating session IDs when none was provided, which caused:
- ❌ Access to random session data
- ❌ Unnecessary session creation
- ❌ No enforcement of session ID requirement
- ❌ Security issue: anyone could access any session's data

## Solution

### 1. Session ID is Now Required

Most endpoints now **require** a session ID. If you don't provide one, you'll get:

```json
{
  "error": "Session ID required",
  "message": "Please provide a session ID via X-Session-Id header, sessionId query parameter, or in request body",
  "hint": "Create a new session by calling POST /api/session/create"
}
```

### 2. New Session Creation Endpoint

**POST /api/session/create** - Creates a new session explicitly

```bash
curl -X POST http://localhost:3001/api/session/create
```

Response:
```json
{
  "sessionId": "e8bcb8e6-97e7-4331-a317-e8e3ed8a07cf",
  "itemCount": 15,
  "createdAt": "2024-11-03T10:30:00.000Z",
  "message": "Session created successfully"
}
```

### 3. How to Use Sessions

#### Step 1: Create a Session
```bash
curl -X POST http://localhost:3001/api/session/create
```

#### Step 2: Use the Session ID

**Option A: Header (Recommended)**
```bash
curl -H "X-Session-Id: your-session-id" \
  http://localhost:3001/api/board-items
```

**Option B: Query Parameter**
```bash
curl http://localhost:3001/api/board-items?sessionId=your-session-id
```

**Option C: Request Body**
```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id",
    "title": "My Todo",
    "todo_items": ["Task 1", "Task 2"]
  }'
```

## Endpoints That Require Session ID

✅ **All protected endpoints now require session ID:**

- `GET /api/board-items`
- `POST /api/board-items`
- `PUT /api/board-items/:id`
- `DELETE /api/board-items/:id`
- `GET /api/events` (SSE)
- `POST /api/todos`
- `POST /api/agents`
- `POST /api/focus`
- `POST /api/lab-results`
- `POST /api/ehr-data`
- `POST /api/doctor-notes`
- `POST /api/enhanced-todo`
- `GET /api/session`
- `DELETE /api/session`
- And more...

## Endpoints That Don't Require Session ID

🔓 **Public endpoints:**

- `GET /api` - API documentation
- `GET /api/health` - Health check
- `POST /api/session/create` - Create new session

## Frontend Changes Needed

Update your frontend to:

1. **Create a session on first load** (if no session exists)
2. **Store the session ID** (localStorage or state)
3. **Include session ID in all API calls**

Example:
```typescript
// Create session if needed
if (!sessionId) {
  const response = await fetch(`${API_BASE_URL}/api/session/create`, {
    method: 'POST'
  });
  const data = await response.json();
  sessionId = data.sessionId;
  localStorage.setItem('sessionId', sessionId);
}

// Use session ID in all requests
const response = await fetch(`${API_BASE_URL}/api/board-items?sessionId=${sessionId}`);
```

## Testing

### Test Without Session ID (Should Fail)
```bash
curl http://localhost:3001/api/board-items
```

Expected:
```json
{
  "error": "Session ID required",
  "message": "Please provide a session ID via X-Session-Id header, sessionId query parameter, or in request body",
  "hint": "Create a new session by calling POST /api/session/create"
}
```

### Test With Session ID (Should Work)
```bash
# Create session
SESSION_ID=$(curl -s -X POST http://localhost:3001/api/session/create | jq -r '.sessionId')

# Use session
curl -H "X-Session-Id: $SESSION_ID" http://localhost:3001/api/board-items
```

## Migration Guide

If you have existing code that relies on auto-generated sessions:

### Before:
```bash
# This used to work (auto-generated session)
curl http://localhost:3001/api/board-items
```

### After:
```bash
# Step 1: Create session explicitly
SESSION_ID=$(curl -s -X POST http://localhost:3001/api/session/create | jq -r '.sessionId')

# Step 2: Use session ID
curl -H "X-Session-Id: $SESSION_ID" http://localhost:3001/api/board-items
```

## Benefits

✅ **Security**: No accidental access to other sessions
✅ **Explicit**: Sessions are created intentionally
✅ **Clear**: Error messages guide users
✅ **Consistent**: All endpoints follow same pattern
✅ **Traceable**: Session creation is logged

## Error Handling

When you forget to include a session ID:

```json
{
  "error": "Session ID required",
  "message": "Please provide a session ID via X-Session-Id header, sessionId query parameter, or in request body",
  "hint": "Create a new session by calling POST /api/session/create"
}
```

The error message tells you exactly what to do!
