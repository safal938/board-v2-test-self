# Agent Zone Parameter Documentation

## Overview

The `/api/agents` endpoint now supports a `zone` parameter that allows you to specify which zone on the canvas the agent result should appear in.

## API Endpoint

### POST /api/agents

Create a new agent result item in a specific zone.

**Request:**
```bash
POST http://localhost:3001/api/agents
Content-Type: application/json

{
  "title": "Lab Analysis Result",
  "content": "Analysis of patient's lab results...",
  "zone": "retrieved-data-zone"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Title of the agent result |
| `content` | string | Yes | Content/markdown of the result |
| `zone` | string | No | Target zone name (defaults to task-management-zone) |
| `x` | number | No | Manual X coordinate (overrides zone) |
| `y` | number | No | Manual Y coordinate (overrides zone) |

## Available Zones

| Zone Name | Location | Description |
|-----------|----------|-------------|
| `task-management-zone` | Right side, top | Default zone for tasks and todos |
| `retrieved-data-zone` | Right side, top-right | Agent results and retrieved data |
| `doctors-note-zone` | Right side, middle-right | Clinical notes |
| `adv-event-zone` | Left side, top | Adverse events monitoring |
| `data-zone` | Left side, middle | Processed encounter data |
| `raw-ehr-data-zone` | Left side, top-left | Raw EHR system data |
| `web-interface-zone` | Far left | Web interfaces and iframes |

## Zone Coordinates

```javascript
{
  "task-management-zone": { x: 4200, y: 0, width: 2000, height: 2100 },
  "retrieved-data-zone": { x: 4200, y: -4600, width: 2000, height: 2100 },
  "doctors-note-zone": { x: 4200, y: -2300, width: 2000, height: 2100 },
  "adv-event-zone": { x: 0, y: 0, width: 4000, height: 2300 },
  "data-zone": { x: 0, y: -1300, width: 4000, height: 1000 },
  "raw-ehr-data-zone": { x: 0, y: -4600, width: 4000, height: 3000 },
  "web-interface-zone": { x: -2200, y: 0, width: 2000, height: 1500 }
}
```

## Usage Examples

### Example 1: Default (Task Management Zone)

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task Analysis",
    "content": "Analysis of pending tasks..."
  }'
```

Result: Agent appears in **Task Management Zone** (default)

### Example 2: Retrieved Data Zone

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Lab Data Analysis",
    "content": "Retrieved lab results show...",
    "zone": "retrieved-data-zone"
  }'
```

Result: Agent appears in **Retrieved Data Zone**

### Example 3: Doctor's Note Zone

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Clinical Summary",
    "content": "Patient clinical summary...",
    "zone": "doctors-note-zone"
  }'
```

Result: Agent appears in **Doctor's Notes Zone**

### Example 4: Adverse Event Zone

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Adverse Event Detection",
    "content": "Detected potential adverse event...",
    "zone": "adv-event-zone"
  }'
```

Result: Agent appears in **Adverse Events Zone**

### Example 5: Manual Positioning (Overrides Zone)

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Custom Position",
    "content": "Agent at custom location...",
    "x": 1000,
    "y": 500
  }'
```

Result: Agent appears at exact coordinates (1000, 500)

## JavaScript Examples

### Example 1: Create Agent in Retrieved Data Zone

```javascript
async function createAgentInRetrievedZone(title, content) {
  const response = await fetch('http://localhost:3001/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title,
      content: content,
      zone: 'retrieved-data-zone'
    })
  });
  
  return response.json();
}

// Usage
await createAgentInRetrievedZone(
  'Lab Analysis',
  'Patient lab results indicate...'
);
```

### Example 2: Create Agent Based on Type

```javascript
async function createAgentByType(title, content, type) {
  // Map types to zones
  const zoneMap = {
    'lab-analysis': 'retrieved-data-zone',
    'clinical-note': 'doctors-note-zone',
    'adverse-event': 'adv-event-zone',
    'task': 'task-management-zone'
  };
  
  const zone = zoneMap[type] || 'task-management-zone';
  
  const response = await fetch('http://localhost:3001/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, zone })
  });
  
  return response.json();
}

// Usage
await createAgentByType(
  'Lab Results',
  'Analysis complete...',
  'lab-analysis'
);
```

### Example 3: Voice Command Integration

```javascript
async function handleVoiceAgentCommand(transcript, context) {
  // Determine zone based on context
  let zone = 'task-management-zone';
  
  if (context.includes('lab') || context.includes('test')) {
    zone = 'retrieved-data-zone';
  } else if (context.includes('note') || context.includes('clinical')) {
    zone = 'doctors-note-zone';
  } else if (context.includes('adverse') || context.includes('event')) {
    zone = 'adv-event-zone';
  }
  
  const response = await fetch('http://localhost:3001/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Voice Command Result',
      content: transcript,
      zone: zone
    })
  });
  
  return response.json();
}
```

## Positioning Logic

### 1. Manual Coordinates (Highest Priority)
If `x` and `y` are provided, they override everything:
```json
{ "x": 1000, "y": 500 }
```

### 2. Zone-Based Positioning
If `zone` is provided, the agent is placed in that zone:
```json
{ "zone": "retrieved-data-zone" }
```

### 3. Default (Task Management Zone)
If neither `x`, `y`, nor `zone` are provided:
```json
{ "title": "...", "content": "..." }
```

## Auto-Positioning Within Zones

When using zone-based positioning, the system automatically:

1. **Finds available space** in the zone
2. **Arranges items in columns** (up to 3 columns per zone)
3. **Avoids overlaps** with existing items
4. **Handles overflow** by finding space in other columns

### Column Layout

```
Zone:
┌─────────────────────────────────────┐
│  Col 0    Col 1    Col 2            │
│  ┌────┐  ┌────┐  ┌────┐            │
│  │ 1  │  │ 4  │  │ 7  │            │
│  └────┘  └────┘  └────┘            │
│  ┌────┐  ┌────┐  ┌────┐            │
│  │ 2  │  │ 5  │  │ 8  │            │
│  └────┘  └────┘  └────┘            │
│  ┌────┐  ┌────┐                    │
│  │ 3  │  │ 6  │                    │
│  └────┘  └────┘                    │
└─────────────────────────────────────┘
```

## Response

**Success Response:**
```json
{
  "id": "item-1730000000000-abc123",
  "type": "agent",
  "x": 4260,
  "y": -4540,
  "width": 520,
  "height": 250,
  "content": "Analysis of patient's lab results...",
  "agentData": {
    "title": "Lab Analysis Result",
    "markdown": "Analysis of patient's lab results..."
  },
  "createdAt": "2025-10-29T12:00:00.000Z",
  "updatedAt": "2025-10-29T12:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "title (string) and content (string) are required"
}
```

## Testing

### Test Script

```bash
# Test 1: Default zone
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{"title": "Test 1", "content": "Default zone test"}'

# Test 2: Retrieved data zone
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{"title": "Test 2", "content": "Retrieved zone test", "zone": "retrieved-data-zone"}'

# Test 3: Doctor's note zone
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{"title": "Test 3", "content": "Doctors zone test", "zone": "doctors-note-zone"}'

# Test 4: Manual position
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -d '{"title": "Test 4", "content": "Manual position test", "x": 1000, "y": 500}'
```

### Verify in Browser

1. Start backend: `node api/server.js`
2. Start frontend: `npm start`
3. Run test commands above
4. Check canvas to see agents in different zones

## Use Cases

### 1. Lab Analysis Results
```javascript
// Place lab analysis in retrieved data zone
await fetch('/api/agents', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Lab Analysis',
    content: 'Patient lab results...',
    zone: 'retrieved-data-zone'
  })
});
```

### 2. Clinical Summaries
```javascript
// Place clinical summary in doctor's notes zone
await fetch('/api/agents', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Clinical Summary',
    content: 'Patient summary...',
    zone: 'doctors-note-zone'
  })
});
```

### 3. Adverse Event Detection
```javascript
// Place adverse event alert in adverse events zone
await fetch('/api/agents', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Adverse Event Alert',
    content: 'Potential adverse event detected...',
    zone: 'adv-event-zone'
  })
});
```

### 4. Task Recommendations
```javascript
// Place task recommendations in task management zone
await fetch('/api/agents', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Recommended Tasks',
    content: 'Based on analysis...',
    zone: 'task-management-zone'
  })
});
```

## Best Practices

1. **Use appropriate zones** for content type
2. **Let auto-positioning work** - avoid manual coordinates unless necessary
3. **Use descriptive titles** for better organization
4. **Keep content concise** for better readability
5. **Test in different zones** to find best placement

## Troubleshooting

### Agent Not Appearing in Expected Zone

**Check:**
1. Zone name is spelled correctly
2. Backend server is running
3. Frontend is connected to backend
4. Check browser console for errors

### Agent Overlapping Other Items

**Solution:**
- The auto-positioning should prevent this
- If it happens, try refreshing the page
- Check if manual coordinates were used

### Zone Not Found

**Error:** Agent appears in default zone instead

**Solution:**
- Verify zone name matches exactly (case-sensitive)
- Check available zones list above
- Use one of the predefined zone names

## Summary

The `zone` parameter provides flexible control over where agent results appear on the canvas:

- ✅ **7 predefined zones** for different content types
- ✅ **Auto-positioning** within zones
- ✅ **Collision detection** to avoid overlaps
- ✅ **Manual override** with x/y coordinates
- ✅ **Default fallback** to task management zone

**Quick Reference:**
```javascript
// Default zone
{ title, content }

// Specific zone
{ title, content, zone: "retrieved-data-zone" }

// Manual position
{ title, content, x: 1000, y: 500 }
```
