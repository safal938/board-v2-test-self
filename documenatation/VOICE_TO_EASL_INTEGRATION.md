# Voice Agent to EASL Integration Guide

## Overview

Your Google Meet voice agent can send queries directly to the EASL iframe using the `/api/send-to-easl` endpoint. The query will appear in the EASL chat interface automatically.

## API Endpoint

### POST /api/send-to-easl

Send a voice query from Google Meet to the EASL iframe.

**Endpoint:** `POST http://localhost:3001/api/send-to-easl`

**Request Body:**
```json
{
  "query": "What are the patient's current medications?",
  "metadata": {
    "source": "voice",
    "meetingId": "abc-defg-hij",
    "timestamp": "2025-10-29T12:00:00.000Z",
    "speaker": "Dr. Smith"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Query sent to EASL",
  "query": "What are the patient's current medications?",
  "metadata": {
    "source": "voice",
    "meetingId": "abc-defg-hij",
    "timestamp": "2025-10-29T12:00:00.000Z",
    "speaker": "Dr. Smith"
  }
}
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Google Meet                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Voice Agent (Listening)                               │ │
│  │  "What are the patient's medications?"                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           │ 1. Transcribe voice              │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  POST /api/send-to-easl                                │ │
│  │  { query: "...", metadata: {...} }                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ 2. Send via SSE
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Canvas Board (Browser)                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SSE Listener receives "easl-query" event              │ │
│  │  Calls window.sendQueryToEASL(query, metadata)        │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           │ 3. postMessage                   │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  EASL Iframe                                           │ │
│  │  - Receives query via postMessage                      │ │
│  │  - Displays in chat interface                          │ │
│  │  - Processes with AI                                   │ │
│  │  - Shows response                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Voice Agent Implementation

### Example 1: Simple Voice Query

```javascript
// In your Google Meet voice agent
async function sendVoiceQueryToEASL(transcript) {
  const response = await fetch('http://localhost:3001/api/send-to-easl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: transcript,
      metadata: {
        source: 'voice',
        timestamp: new Date().toISOString()
      }
    })
  });
  
  const result = await response.json();
  console.log('Query sent to EASL:', result);
  return result;
}

// Usage
const transcript = "What are the patient's current medications?";
await sendVoiceQueryToEASL(transcript);
```

### Example 2: With Meeting Context

```javascript
// In your Google Meet voice agent
async function sendVoiceQueryWithContext(transcript, meetingInfo) {
  const response = await fetch('http://localhost:3001/api/send-to-easl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: transcript,
      metadata: {
        source: 'voice',
        meetingId: meetingInfo.id,
        meetingUrl: meetingInfo.url,
        speaker: meetingInfo.currentSpeaker,
        timestamp: new Date().toISOString(),
        participants: meetingInfo.participants
      }
    })
  });
  
  return response.json();
}

// Usage
await sendVoiceQueryWithContext(
  "Analyze the patient's lab results",
  {
    id: "abc-defg-hij",
    url: "https://meet.google.com/abc-defg-hij",
    currentSpeaker: "Dr. Smith",
    participants: ["Dr. Smith", "Dr. Jones"]
  }
);
```

### Example 3: With Patient Context

```javascript
// In your Google Meet voice agent
async function sendVoiceQueryWithPatient(transcript, patientId) {
  const response = await fetch('http://localhost:3001/api/send-to-easl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: transcript,
      metadata: {
        source: 'voice',
        patientId: patientId,
        context: 'patient-review',
        timestamp: new Date().toISOString()
      }
    })
  });
  
  return response.json();
}

// Usage
await sendVoiceQueryWithPatient(
  "What medications is this patient taking?",
  "P001"
);
```

### Example 4: Error Handling

```javascript
// In your Google Meet voice agent
async function sendVoiceQuerySafe(transcript, metadata = {}) {
  try {
    const response = await fetch('http://localhost:3001/api/send-to-easl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: transcript,
        metadata: {
          source: 'voice',
          ...metadata,
          timestamp: new Date().toISOString()
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Query sent to EASL:', result.query);
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Failed to send query to EASL:', error);
    return { success: false, error: error.message };
  }
}

// Usage
const result = await sendVoiceQuerySafe(
  "What are the risk factors for DILI?",
  { meetingId: "abc-defg-hij" }
);

if (result.success) {
  console.log('Query delivered successfully');
} else {
  console.log('Failed to deliver query:', result.error);
}
```

## Production Deployment

### For Production (Vercel)

```javascript
// Use production URL
const API_URL = 'https://board-v25.vercel.app';

async function sendVoiceQuery(transcript, metadata) {
  const response = await fetch(`${API_URL}/api/send-to-easl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: transcript,
      metadata: {
        source: 'voice',
        ...metadata
      }
    })
  });
  
  return response.json();
}
```

### Environment Variables

```javascript
// Use environment variable for flexibility
const API_URL = process.env.BOARD_API_URL || 'http://localhost:3001';

async function sendVoiceQuery(transcript) {
  const response = await fetch(`${API_URL}/api/send-to-easl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: transcript,
      metadata: { source: 'voice' }
    })
  });
  
  return response.json();
}
```

## Testing

### Test from Command Line

```bash
# Test the endpoint
curl -X POST http://localhost:3001/api/send-to-easl \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Test voice query from Google Meet",
    "metadata": {
      "source": "voice",
      "meetingId": "test-meeting",
      "timestamp": "2025-10-29T12:00:00.000Z"
    }
  }'
```

### Test from Node.js

```javascript
// test-voice-to-easl.js
const fetch = require('node-fetch');

async function testVoiceQuery() {
  const response = await fetch('http://localhost:3001/api/send-to-easl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "What are the patient's current medications?",
      metadata: {
        source: 'voice',
        meetingId: 'test-123',
        timestamp: new Date().toISOString()
      }
    })
  });
  
  const result = await response.json();
  console.log('Result:', result);
}

testVoiceQuery();
```

### Verify in Browser

1. Open canvas board: `http://localhost:3000`
2. Navigate to EASL iframe
3. Send test query from voice agent
4. Check EASL chat interface for the query

## Common Voice Commands

### Medical Queries

```javascript
const medicalQueries = [
  "What are the patient's current medications?",
  "Analyze the latest lab results",
  "What are the risk factors for DILI?",
  "Summarize the patient's medical history",
  "What adverse events have been detected?",
  "Review the patient's vital signs",
  "What is the current treatment plan?",
  "Are there any drug interactions?"
];

// Send any of these
await sendVoiceQuery(medicalQueries[0]);
```

### Context-Aware Queries

```javascript
// Get selected item first
const selectedResponse = await fetch('http://localhost:3001/api/selected-item');
const { selectedItem } = await selectedResponse.json();

// Send context-aware query
if (selectedItem) {
  await sendVoiceQuery(
    `Analyze this ${selectedItem.type}`,
    { selectedItemId: selectedItem.id }
  );
}
```

## Integration Patterns

### Pattern 1: Direct Voice-to-EASL

```javascript
// Voice agent listens → Transcribes → Sends to EASL
voiceAgent.on('transcript', async (text) => {
  await sendVoiceQuery(text);
});
```

### Pattern 2: Command Detection

```javascript
// Detect specific commands
voiceAgent.on('transcript', async (text) => {
  if (text.toLowerCase().includes('ask easl')) {
    const query = text.replace(/ask easl/i, '').trim();
    await sendVoiceQuery(query);
  }
});
```

### Pattern 3: Continuous Conversation

```javascript
// Keep conversation context
let conversationContext = [];

voiceAgent.on('transcript', async (text) => {
  conversationContext.push(text);
  
  await sendVoiceQuery(text, {
    conversationHistory: conversationContext.slice(-5) // Last 5 messages
  });
});
```

### Pattern 4: Multi-Modal

```javascript
// Combine voice with selected item
voiceAgent.on('transcript', async (text) => {
  const selected = await fetch('/api/selected-item').then(r => r.json());
  
  await sendVoiceQuery(text, {
    selectedItem: selected.selectedItem,
    context: 'multi-modal'
  });
});
```

## Metadata Fields

Recommended metadata fields to include:

```javascript
{
  "source": "voice",              // Always "voice" for voice queries
  "meetingId": "abc-defg-hij",    // Google Meet meeting ID
  "meetingUrl": "https://...",    // Meeting URL
  "speaker": "Dr. Smith",         // Current speaker name
  "timestamp": "2025-10-29...",   // ISO timestamp
  "patientId": "P001",            // Patient context (if available)
  "selectedItemId": "item-123",   // Selected item (if available)
  "conversationId": "conv-456",   // Conversation thread ID
  "language": "en",               // Language code
  "confidence": 0.95              // Transcription confidence
}
```

## Response Handling

### Success Response

```json
{
  "success": true,
  "message": "Query sent to EASL",
  "query": "What are the patient's medications?",
  "metadata": { ... }
}
```

### Error Response

```json
{
  "error": "Query is required"
}
```

## Troubleshooting

### Query Not Appearing in EASL

**Check:**
1. Backend server is running
2. Frontend is connected to backend
3. EASL iframe is loaded
4. SSE connection is active
5. Browser console for errors

**Debug:**
```javascript
// Check SSE connection
// In browser console
fetch('http://localhost:3001/api/events')
  .then(r => console.log('SSE connected'))
  .catch(e => console.error('SSE error:', e));
```

### Voice Agent Can't Reach API

**Check:**
1. API URL is correct
2. CORS is enabled
3. Network connectivity
4. Firewall settings

**Test:**
```bash
curl http://localhost:3001/api/send-to-easl \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

## Best Practices

1. **Include Metadata**: Always include source, timestamp, and context
2. **Error Handling**: Wrap API calls in try-catch
3. **Retry Logic**: Implement retry for failed requests
4. **Rate Limiting**: Don't spam queries too quickly
5. **Context Awareness**: Include patient/meeting context when available
6. **Logging**: Log all queries for debugging
7. **Validation**: Validate transcript before sending

## Example: Complete Voice Agent

```javascript
class VoiceToEASLAgent {
  constructor(apiUrl = 'http://localhost:3001') {
    this.apiUrl = apiUrl;
    this.conversationHistory = [];
  }
  
  async sendQuery(transcript, metadata = {}) {
    try {
      const response = await fetch(`${this.apiUrl}/api/send-to-easl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: transcript,
          metadata: {
            source: 'voice',
            timestamp: new Date().toISOString(),
            conversationHistory: this.conversationHistory.slice(-5),
            ...metadata
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      this.conversationHistory.push(transcript);
      
      console.log('✅ Query sent:', transcript);
      return { success: true, result };
      
    } catch (error) {
      console.error('❌ Failed to send query:', error);
      return { success: false, error: error.message };
    }
  }
  
  async sendWithContext(transcript, meetingInfo, patientId) {
    return this.sendQuery(transcript, {
      meetingId: meetingInfo.id,
      meetingUrl: meetingInfo.url,
      speaker: meetingInfo.currentSpeaker,
      patientId: patientId
    });
  }
  
  clearHistory() {
    this.conversationHistory = [];
  }
}

// Usage
const agent = new VoiceToEASLAgent('http://localhost:3001');

// Simple query
await agent.sendQuery("What are the patient's medications?");

// With context
await agent.sendWithContext(
  "Analyze the lab results",
  { id: "meet-123", currentSpeaker: "Dr. Smith" },
  "P001"
);
```

## Summary

The `/api/send-to-easl` endpoint is ready to use for your Google Meet voice agent:

- ✅ **Endpoint**: `POST /api/send-to-easl`
- ✅ **Parameters**: `query` (required), `metadata` (optional)
- ✅ **Flow**: Voice → API → SSE → Canvas → EASL iframe
- ✅ **Real-time**: Query appears immediately in EASL chat
- ✅ **Context-aware**: Include meeting and patient metadata
- ✅ **Production-ready**: Works in both dev and production

Just send the transcribed voice query to the endpoint, and it will appear in the EASL chat interface automatically!
