# Agent Session ID Guide

## Overview

The board API now accepts session IDs in **multiple formats** for maximum compatibility with different agent implementations.

## Session ID Formats Supported

The API accepts session IDs in any of these formats:

### 1. HTTP Header (Recommended)
```python
headers = {
    'Content-Type': 'application/json',
    'X-Session-Id': session_id
}
```

### 2. Query Parameter (Both formats)
```python
# camelCase
url = f"{API_BASE_URL}/api/todos?sessionId={session_id}"

# snake_case (agent-friendly)
url = f"{API_BASE_URL}/api/todos?session_id={session_id}"
```

### 3. Request Body (Both formats)
```python
# camelCase
body = {
    'sessionId': session_id,
    'title': 'Task',
    'todo_items': ['Item 1']
}

# snake_case (agent-friendly)
body = {
    'session_id': session_id,
    'title': 'Task',
    'todo_items': ['Item 1']
}
```

## Agent Implementation

### Python Example

```python
import requests

class MedForceAgent:
    def __init__(self, api_base_url="https://board-v25.vercel.app"):
        self.api_base_url = api_base_url
        self.session_id = None
    
    def join_meeting(self, meet_url, session_id):
        """Store session ID when joining meeting"""
        self.session_id = session_id
        print(f"✅ Joined meeting with session: {session_id}")
    
    def create_todo(self, title, items):
        """Create a todo item on the board"""
        if not self.session_id:
            raise ValueError("No session ID - call join_meeting first")
        
        response = requests.post(
            f"{self.api_base_url}/api/todos",
            json={
                'session_id': self.session_id,  # ← snake_case works!
                'title': title,
                'todo_items': items
            }
        )
        
        if response.ok:
            data = response.json()
            print(f"✅ Created todo: {data['item']['id']}")
            return data
        else:
            print(f"❌ Failed to create todo: {response.status_code}")
            print(response.text)
            return None
    
    def create_agent_result(self, title, content, zone=None):
        """Create an agent result card on the board"""
        if not self.session_id:
            raise ValueError("No session ID - call join_meeting first")
        
        payload = {
            'session_id': self.session_id,  # ← snake_case works!
            'title': title,
            'content': content
        }
        
        if zone:
            payload['zone'] = zone
        
        response = requests.post(
            f"{self.api_base_url}/api/agents",
            json=payload
        )
        
        if response.ok:
            data = response.json()
            print(f"✅ Created agent result: {data['item']['id']}")
            return data
        else:
            print(f"❌ Failed to create agent result: {response.status_code}")
            print(response.text)
            return None
    
    def create_lab_result(self, parameter, value, unit, status, range_min, range_max, trend="stable"):
        """Create a lab result card on the board"""
        if not self.session_id:
            raise ValueError("No session ID - call join_meeting first")
        
        response = requests.post(
            f"{self.api_base_url}/api/lab-results",
            json={
                'session_id': self.session_id,  # ← snake_case works!
                'parameter': parameter,
                'value': value,
                'unit': unit,
                'status': status,
                'range': {
                    'min': range_min,
                    'max': range_max
                },
                'trend': trend
            }
        )
        
        if response.ok:
            data = response.json()
            print(f"✅ Created lab result: {data['item']['id']}")
            return data
        else:
            print(f"❌ Failed to create lab result: {response.status_code}")
            print(response.text)
            return None
    
    def create_doctor_note(self, content=""):
        """Create a doctor's note on the board"""
        if not self.session_id:
            raise ValueError("No session ID - call join_meeting first")
        
        response = requests.post(
            f"{self.api_base_url}/api/doctor-notes",
            json={
                'session_id': self.session_id,  # ← snake_case works!
                'content': content
            }
        )
        
        if response.ok:
            data = response.json()
            print(f"✅ Created doctor's note: {data['item']['id']}")
            return data
        else:
            print(f"❌ Failed to create doctor's note: {response.status_code}")
            print(response.text)
            return None

# Usage Example
agent = MedForceAgent()

# 1. Join meeting with session ID
agent.join_meeting(
    meet_url="https://meet.google.com/abc-defg-hij",
    session_id="550e8400-e29b-41d4-a716-446655440000"
)

# 2. Create items on the board
agent.create_todo(
    title="Clinical Action Items",
    items=["Order LFT panel", "Check Hepatitis serologies", "Schedule consult"]
)

agent.create_agent_result(
    title="Risk Analysis",
    content="# Risk Assessment\n\n## Risk Level: HIGH\n\n### Factors\n- Medication interaction detected\n- Monitoring gap identified",
    zone="task-management-zone"
)

agent.create_lab_result(
    parameter="ALT",
    value=85,
    unit="U/L",
    status="warning",
    range_min=7,
    range_max=56,
    trend="increasing"
)

agent.create_doctor_note(
    content="Patient shows signs of hepatotoxicity. Recommend urgent LFT panel."
)
```

## Testing

### Test Session ID Formats

```bash
# Get a session ID from the browser or create one
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"

# Test 1: snake_case in body (agent format)
curl -X POST https://board-v25.vercel.app/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'$SESSION_ID'",
    "title": "Test Todo (snake_case)",
    "todo_items": ["Task 1", "Task 2"]
  }'

# Test 2: camelCase in body (frontend format)
curl -X POST https://board-v25.vercel.app/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "title": "Test Todo (camelCase)",
    "todo_items": ["Task 1", "Task 2"]
  }'

# Test 3: snake_case in query param
curl -X POST "https://board-v25.vercel.app/api/todos?session_id=$SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Todo (query param)",
    "todo_items": ["Task 1", "Task 2"]
  }'

# Test 4: Header (recommended)
curl -X POST https://board-v25.vercel.app/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Test Todo (header)",
    "todo_items": ["Task 1", "Task 2"]
  }'

# Verify items were created
curl "https://board-v25.vercel.app/api/board-items?session_id=$SESSION_ID"
```

## Available Endpoints

All endpoints support `session_id` (snake_case) and `sessionId` (camelCase):

### Create Todo
```
POST /api/todos
Body: { session_id, title, todo_items }
```

### Create Agent Result
```
POST /api/agents
Body: { session_id, title, content, zone? }
```

### Create Lab Result
```
POST /api/lab-results
Body: { session_id, parameter, value, unit, status, range, trend? }
```

### Create Doctor's Note
```
POST /api/doctor-notes
Body: { session_id, content? }
```

### Create EHR Data
```
POST /api/ehr-data
Body: { session_id, title, content, dataType?, source? }
```

### Get Board Items
```
GET /api/board-items?session_id={id}
```

### Focus on Item
```
POST /api/focus
Body: { session_id, itemId, subElement?, focusOptions? }
```

## Troubleshooting

### Items Not Appearing on Board

**Check 1: Session ID Match**
```python
# Make sure the session ID matches what the frontend is using
print(f"Agent session ID: {agent.session_id}")
# Compare with browser console: localStorage.getItem('boardSessionId')
```

**Check 2: API Response**
```python
response = agent.create_todo("Test", ["Item 1"])
if response:
    print(f"Created in session: {response['sessionId']}")
    print(f"Item ID: {response['item']['id']}")
```

**Check 3: Backend Logs**
Look for:
```
✅ Created todo item: item-123 in session 550e8400-...
📡 SSE client connected to session: 550e8400-...
```

**Check 4: Frontend Console**
Look for:
```
📦 Parsed new-item data: { item: {...}, sessionId: "550e8400-..." }
✅ Adding new item item-123 to state
```

### Session ID Not Being Passed

If you see this error:
```
🆕 Created new session: <random-uuid>
```

It means the session ID wasn't included in the request. Make sure you're passing it in one of the supported formats.

## Best Practices

1. **Store session ID**: Save it when joining the meeting
2. **Use snake_case**: More natural for Python agents
3. **Check responses**: Verify the returned `sessionId` matches
4. **Handle errors**: Check response status codes
5. **Log everything**: Print session IDs for debugging

## Summary

✅ **Both formats work**: `session_id` (snake_case) and `sessionId` (camelCase)  
✅ **Multiple methods**: Header, query param, or body  
✅ **Agent-friendly**: Use snake_case for Python compatibility  
✅ **Automatic sync**: Items appear on board via SSE  
✅ **Session isolation**: Each meeting has its own board state

The agent can now use `session_id` in the request body and it will work perfectly!
