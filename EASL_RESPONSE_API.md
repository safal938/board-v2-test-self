# EASL Response API Documentation

## Overview

When the EASL chat app completes rendering a response, it should send the complete conversation (query + response) back to the board app. The board app will store this in Redis/boardItems.json for persistence, but will NOT render it (since EASL already displays it).

## API Endpoint

### POST /api/easl-response

Send a complete response from EASL chat app to the board app for storage.

**Endpoint:** `POST http://localhost:3001/api/easl-response`

**Request Body:**
```json
{
  "response_type": "complete",
  "query": "What are the patient's current medications?",
  "response": "Based on the patient's medical records, the current medications are:\n\n1. **Methotrexate** - 20mg weekly\n2. **Folic Acid** - 5mg weekly\n3. **Lisinopril** - 10mg daily\n\nThese medications are being used to manage the patient's rheumatoid arthritis and hypertension.",
  "metadata": {
    "source": "voice",
    "meetingId": "abc-defg-hij",
    "speaker": "Dr. Smith",
    "processingTime": 2.5,
    "model": "gpt-4",
    "timestamp": "2025-10-29T12:00:00.000Z"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Response saved successfully",
  "conversationId": "conv-1730000000000",
  "totalConversations": 15
}
```

**Response (Error):**
```json
{
  "error": "Only complete responses are accepted",
  "received_type": "streaming"
}
```

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `response_type` | string | Yes | Must be "complete" |
| `query` | string | Yes | The original query/question |
| `response` | string | Yes | The complete AI response |
| `metadata` | object | No | Additional context and information |

### Metadata Fields (Optional)

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source of query (voice, ui, api) |
| `meetingId` | string | Google Meet meeting ID |
| `speaker` | string | Name of person who asked |
| `processingTime` | number | Time taken to generate response (seconds) |
| `model` | string | AI model used (gpt-4, claude, etc.) |
| `timestamp` | string | ISO timestamp |
| `conversationId` | string | Thread/conversation ID |
| `tokens` | object | Token usage info |

## Storage Structure

The response is stored in the EASL iframe item in boardItems.json:

```json
{
  "id": "iframe-item-easl-interface",
  "type": "iframe",
  "x": 6500,
  "y": 100,
  "width": 1800,
  "height": 1000,
  "title": "EASL Web Interface",
  "iframeUrl": "http://localhost:8008/",
  "color": "#ffffff",
  "rotation": 0,
  "conversationHistory": [
    {
      "id": "conv-1730000000000",
      "query": "What are the patient's medications?",
      "response": "Based on the patient's medical records...",
      "timestamp": "2025-10-29T12:00:00.000Z",
      "metadata": {
        "source": "voice",
        "processingTime": 2.5
      },
      "response_type": "complete"
    }
  ],
  "createdAt": "2025-10-28T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:00:00.000Z"
}
```

## Implementation in EASL Chat App

### Example 1: Send Response After Completion

```javascript
// In your EASL chat app
async function sendResponseToBoard(query, response, metadata = {}) {
  try {
    const apiResponse = await fetch('http://localhost:3001/api/easl-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'complete',
        query: query,
        response: response,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      })
    });

    if (apiResponse.ok) {
      const result = await apiResponse.json();
      console.log('✅ Response saved to board:', result.conversationId);
      return result;
    } else {
      const error = await apiResponse.json();
      console.error('❌ Failed to save response:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error sending response to board:', error);
    return null;
  }
}

// Usage: After AI completes response
const query = "What are the patient's medications?";
const response = "Based on the patient's medical records...";

await sendResponseToBoard(query, response, {
  source: 'voice',
  processingTime: 2.5,
  model: 'gpt-4'
});
```

### Example 2: With Streaming (Send After Complete)

```javascript
// In your EASL chat app with streaming
let accumulatedResponse = '';

// During streaming
stream.on('data', (chunk) => {
  accumulatedResponse += chunk;
  // Display chunk in UI
  displayChunk(chunk);
});

// After streaming completes
stream.on('end', async () => {
  console.log('Streaming complete, sending to board...');
  
  await sendResponseToBoard(
    currentQuery,
    accumulatedResponse,
    {
      source: 'voice',
      processingTime: streamDuration,
      model: 'gpt-4',
      tokens: {
        prompt: 150,
        completion: 500,
        total: 650
      }
    }
  );
});
```

### Example 3: With Error Handling

```javascript
// In your EASL chat app
async function sendResponseSafe(query, response, metadata = {}) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const apiResponse = await fetch('http://localhost:3001/api/easl-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'complete',
          query: query,
          response: response,
          metadata: metadata
        })
      });

      if (apiResponse.ok) {
        const result = await apiResponse.json();
        console.log('✅ Response saved:', result.conversationId);
        return { success: true, result };
      }

      throw new Error(`API error: ${apiResponse.status}`);

    } catch (error) {
      attempt++;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        console.error('❌ All retries failed');
        return { success: false, error: error.message };
      }
    }
  }
}
```

### Example 4: React Hook

```typescript
// In your EASL React app
import { useCallback } from 'react';

function useEASLResponse() {
  const sendResponse = useCallback(async (
    query: string,
    response: string,
    metadata?: Record<string, any>
  ) => {
    try {
      const apiResponse = await fetch('http://localhost:3001/api/easl-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'complete',
          query,
          response,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      const result = await apiResponse.json();
      return { success: true, data: result };

    } catch (error) {
      console.error('Failed to send response:', error);
      return { success: false, error };
    }
  }, []);

  return { sendResponse };
}

// Usage in component
function ChatComponent() {
  const { sendResponse } = useEASLResponse();

  const handleResponseComplete = async (query, response) => {
    const result = await sendResponse(query, response, {
      source: 'ui',
      model: 'gpt-4'
    });

    if (result.success) {
      console.log('Saved to board:', result.data.conversationId);
    }
  };

  return <div>...</div>;
}
```

## Retrieving Conversation History

### GET /api/easl-history

Get stored conversation history from the board.

**Endpoint:** `GET http://localhost:3001/api/easl-history?limit=10`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | all | Number of recent conversations to return |

**Response:**
```json
{
  "success": true,
  "totalConversations": 15,
  "conversations": [
    {
      "id": "conv-1730000000000",
      "query": "What are the patient's medications?",
      "response": "Based on the patient's medical records...",
      "timestamp": "2025-10-29T12:00:00.000Z",
      "metadata": {
        "source": "voice",
        "processingTime": 2.5
      },
      "response_type": "complete"
    }
  ]
}
```

### Example: Retrieve History

```javascript
// Get last 10 conversations
const response = await fetch('http://localhost:3001/api/easl-history?limit=10');
const data = await response.json();

console.log(`Total conversations: ${data.totalConversations}`);
data.conversations.forEach(conv => {
  console.log(`Q: ${conv.query}`);
  console.log(`A: ${conv.response}`);
});
```

## Production Configuration

### For Production (Vercel)

```javascript
// In your EASL app
const BOARD_API_URL = process.env.BOARD_API_URL || 'https://board-v25.vercel.app';

async function sendResponseToBoard(query, response, metadata) {
  const apiResponse = await fetch(`${BOARD_API_URL}/api/easl-response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_type: 'complete',
      query,
      response,
      metadata
    })
  });

  return apiResponse.json();
}
```

### Environment Variables

```bash
# In your EASL app .env file
BOARD_API_URL=http://localhost:3001
# For production:
# BOARD_API_URL=https://board-v25.vercel.app
```

## Testing

### Test from Command Line

```bash
# Send a test response
curl -X POST http://localhost:3001/api/easl-response \
  -H "Content-Type: application/json" \
  -d '{
    "response_type": "complete",
    "query": "Test query",
    "response": "Test response from EASL",
    "metadata": {
      "source": "test",
      "timestamp": "2025-10-29T12:00:00.000Z"
    }
  }'

# Get conversation history
curl http://localhost:3001/api/easl-history?limit=5
```

### Test Script

```javascript
// test-easl-response.js
async function testEASLResponse() {
  // Send response
  const response = await fetch('http://localhost:3001/api/easl-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_type: 'complete',
      query: 'What are the patient\'s medications?',
      response: 'The patient is currently taking Methotrexate 20mg weekly...',
      metadata: {
        source: 'test',
        processingTime: 2.5,
        model: 'gpt-4'
      }
    })
  });

  const result = await response.json();
  console.log('Response saved:', result);

  // Get history
  const historyResponse = await fetch('http://localhost:3001/api/easl-history?limit=5');
  const history = await historyResponse.json();
  console.log('Conversation history:', history);
}

testEASLResponse();
```

## Important Notes

1. **Only Complete Responses**: The endpoint only accepts `response_type: 'complete'`. Streaming chunks should not be sent individually.

2. **No Rendering**: The board app stores the response but does NOT render it. EASL is responsible for displaying the conversation.

3. **History Limit**: Only the last 100 conversations are kept to prevent storage bloat.

4. **Persistence**: Responses are stored in Redis (production) or boardItems.json (development).

5. **Timestamps**: Always include timestamps for proper ordering and debugging.

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Only complete responses are accepted" | Wrong response_type | Use `response_type: 'complete'` |
| "query and response are required" | Missing fields | Include both query and response |
| "EASL iframe item not found" | Item missing from board | Check boardItems.json |
| 500 error | Server error | Check server logs |

### Retry Strategy

```javascript
async function sendWithRetry(query, response, metadata, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await sendResponseToBoard(query, response, metadata);
      return result;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## Flow Diagram

```
EASL Chat App
     │
     │ 1. User asks question
     │
     ▼
  Process with AI
     │
     │ 2. Generate response (streaming)
     │
     ▼
  Display in chat UI
     │
     │ 3. Response complete
     │
     ▼
POST /api/easl-response
  {
    response_type: 'complete',
    query: "...",
    response: "..."
  }
     │
     ▼
Board App Backend
     │
     │ 4. Store in boardItems.json
     │    (conversationHistory array)
     │
     ▼
  Redis/File Storage
     │
     │ 5. Persisted for future retrieval
     │
     ▼
   Success Response
```

## Summary

- ✅ **Endpoint**: `POST /api/easl-response`
- ✅ **Required**: `response_type: 'complete'`, `query`, `response`
- ✅ **Storage**: Stored in iframe item's `conversationHistory`
- ✅ **No Rendering**: Board app only stores, doesn't display
- ✅ **History**: Retrieve with `GET /api/easl-history`
- ✅ **Limit**: Last 100 conversations kept
- ✅ **Production Ready**: Works with Redis or file storage

Send the complete response after rendering is done, and it will be automatically stored in the board's persistent storage!
