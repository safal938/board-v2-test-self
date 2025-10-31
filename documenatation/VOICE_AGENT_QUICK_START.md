# Voice Agent Quick Start

## For Your Google Meet Voice Agent

### Endpoint

```
POST http://localhost:3001/api/send-to-easl
```

### Request

```javascript
{
  "query": "What are the patient's medications?",
  "metadata": {
    "source": "voice",
    "meetingId": "abc-defg-hij",
    "speaker": "Dr. Smith",
    "timestamp": "2025-10-29T12:00:00.000Z"
  }
}
```

### Response

```javascript
{
  "success": true,
  "message": "Query sent to EASL",
  "query": "What are the patient's medications?",
  "metadata": { ... }
}
```

## Implementation

### Simple Version

```javascript
async function sendVoiceQuery(transcript) {
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
  
  return response.json();
}

// Usage
await sendVoiceQuery("What are the patient's medications?");
```

### With Meeting Context

```javascript
async function sendVoiceQuery(transcript, meetingInfo) {
  const response = await fetch('http://localhost:3001/api/send-to-easl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: transcript,
      metadata: {
        source: 'voice',
        meetingId: meetingInfo.id,
        speaker: meetingInfo.currentSpeaker,
        timestamp: new Date().toISOString()
      }
    })
  });
  
  return response.json();
}

// Usage
await sendVoiceQuery(
  "Analyze the lab results",
  { id: "abc-defg-hij", currentSpeaker: "Dr. Smith" }
);
```

## Testing

```bash
# Test the endpoint
node test-voice-agent.js

# Or with curl
curl -X POST http://localhost:3001/api/send-to-easl \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Test from Google Meet",
    "metadata": {
      "source": "voice",
      "meetingId": "test-123"
    }
  }'
```

## Flow

```
Google Meet Voice Agent
        ↓
  Transcribe voice
        ↓
POST /api/send-to-easl
        ↓
   SSE broadcast
        ↓
  Canvas receives
        ↓
 postMessage to EASL
        ↓
EASL displays in chat
```

## Production URL

```javascript
// For production
const API_URL = 'https://board-v25.vercel.app';

await fetch(`${API_URL}/api/send-to-easl`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: transcript,
    metadata: { source: 'voice' }
  })
});
```

## Common Queries

```javascript
const queries = [
  "What are the patient's current medications?",
  "Analyze the latest lab results",
  "What are the risk factors for DILI?",
  "Summarize the patient's medical history",
  "What adverse events have been detected?",
  "Review the patient's vital signs"
];
```

## Error Handling

```javascript
try {
  const response = await fetch('http://localhost:3001/api/send-to-easl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: transcript,
      metadata: { source: 'voice' }
    })
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const result = await response.json();
  console.log('✅ Query sent:', result);
  
} catch (error) {
  console.error('❌ Failed:', error);
}
```

## Documentation

- **VOICE_TO_EASL_INTEGRATION.md** - Complete guide
- **test-voice-agent.js** - Test script
- **IFRAME_COMMUNICATION_GUIDE.md** - Technical details

## That's It!

Just POST the voice transcript to `/api/send-to-easl` and it will appear in the EASL chat automatically.
