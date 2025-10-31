# EASL Iframe Chatbot - Restoration Guide

## Overview
This document describes the EASL (External Application Support Layer) iframe chatbot integration that was commented out. The chatbot is an embedded web interface that communicates with the canvas board via postMessage API.

## What Was Commented Out

### 1. **Iframe Board Item** (`iframe-item-easl-interface`)
The chatbot appears as a board item of type `iframe` that embeds an external web application.

**Location in JSON files:**
- `src/data/boardItems.json` - Line ~1980
- `api/data/boardItems.json` - Line ~1888

**Item Configuration:**
```json
{
  "id": "iframe-item-easl-interface",
  "type": "iframe",
  "x": -2100,  // or 6500 in api version
  "y": 100,
  "width": 1800,
  "height": 1200,  // or 1000 in api version
  "title": "EASL Web Interface",
  "iframeUrl": "https://easl-board.vercel.app/",
  "color": "#ffffff",
  "rotation": 0,
  "createdAt": "2025-10-28T12:00:00.000Z",
  "updatedAt": "2025-10-28T12:00:00.000Z"
}
```

### 2. **Canvas.tsx - Iframe Communication Logic**
**File:** `src/components/Canvas.tsx`

**Lines ~399-426:** Send query to EASL iframe
```typescript
// Send query to EASL iframe
const sendQueryToEASL = useCallback((query: string, metadata?: any) => {
  // Find the EASL iframe element
  const easlIframe = document.querySelector('[data-item-id="iframe-item-easl-interface"] iframe') as HTMLIFrameElement;
  
  if (!easlIframe || !easlIframe.contentWindow) {
    console.error('❌ EASL iframe not found');
    return;
  }

  // Send message to iframe
  const message = {
    type: 'CANVAS_QUERY',
    payload: {
      query: query,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    }
  };

  easlIframe.contentWindow.postMessage(message, 'https://easl-board.vercel.app/');
  console.log('📤 Sent query to EASL:', query);
}, []);

// Expose sendQueryToEASL globally
useEffect(() => {
  (window as any).sendQueryToEASL = sendQueryToEASL;
}, [sendQueryToEASL]);
```

**Lines ~429-449:** Listen for responses from EASL iframe
```typescript
// Listen for responses from EASL iframe
useEffect(() => {
  const handleEASLResponse = (event: MessageEvent) => {
    // Security check
    if (event.origin !== 'https://easl-board.vercel.app/') {
      return;
    }

    if (event.data?.type === 'EASL_RESPONSE') {
      const { response, timestamp } = event.data.payload;
      console.log('📥 Received response from EASL:', response);
      
      // Handle the response (e.g., display notification, update state)
      // You could create a new board item with the response
    }
  };

  window.addEventListener('message', handleEASLResponse);
  
  return () => {
    window.removeEventListener('message', handleEASLResponse);
  };
}, []);
```

### 3. **BoardItem.tsx - Iframe Rendering**
**File:** `src/components/BoardItem.tsx`
**Lines ~849-872:**

```typescript
case "iframe":
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: "12px",
      }}
    >
      <iframe
        src={item.iframeUrl || "about:blank"}
        title={item.title || "Web Interface"}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "12px",
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
```

### 4. **Server API Endpoints**
All three server files have identical endpoints for EASL communication:

**Files:**
- `api/server.js` - Lines ~1675-1791
- `api/server-vercel.js` - Lines ~1667-1783
- `api/server-redis.js` - Lines ~1715-1831

**Endpoint 1: POST /api/send-to-easl**
Sends a query to the EASL iframe via Server-Sent Events (SSE).

```javascript
app.post("/api/send-to-easl", (req, res) => {
  const { query, metadata } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  // Broadcast to all SSE clients
  const message = {
    type: "EASL_QUERY",
    payload: {
      query,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    },
  };

  sseClients.forEach((client) => {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  });

  res.json({
    success: true,
    message: "Query sent to EASL iframe",
    query,
  });
});
```

**Endpoint 2: PUT /api/board-items/iframe-item-easl-interface**
Updates the EASL iframe item position and broadcasts via SSE.

```javascript
app.put("/api/board-items/iframe-item-easl-interface", async (req, res) => {
  try {
    const items = await loadBoardItems();
    const easlItemIndex = items.findIndex(item => item.id === "iframe-item-easl-interface");

    if (easlItemIndex === -1) {
      console.warn("⚠️  EASL iframe item not found in board items");
      return res.status(404).json({ 
        error: "EASL iframe item not found" 
      });
    }

    // Update the item
    items[easlItemIndex] = {
      ...items[easlItemIndex],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    await saveBoardItems(items);

    // Broadcast update via SSE
    const message = {
      type: "ITEM_UPDATED",
      payload: items[easlItemIndex],
    };

    sseClients.forEach((client) => {
      client.write(`data: ${JSON.stringify(message)}\n\n`);
    });

    res.json(items[easlItemIndex]);
  } catch (error) {
    console.error("Error updating EASL iframe item:", error);
    res.status(500).json({ error: "Failed to update EASL iframe item" });
  }
});
```

**Endpoint 3: GET /api/board-items/iframe-item-easl-interface**
Retrieves the EASL iframe item.

```javascript
app.get("/api/board-items/iframe-item-easl-interface", async (req, res) => {
  try {
    const items = await loadBoardItems();
    const easlItem = items.find(item => item.id === "iframe-item-easl-interface");

    if (!easlItem) {
      return res.status(404).json({ 
        error: "EASL iframe item not found" 
      });
    }

    res.json(easlItem);
  } catch (error) {
    console.error("Error fetching EASL iframe item:", error);
    res.status(500).json({ error: "Failed to fetch EASL iframe item" });
  }
});
```

## Communication Protocol

### Message Format: Canvas → EASL
```typescript
{
  type: 'CANVAS_QUERY',
  payload: {
    query: string,           // The query text
    timestamp: string,       // ISO timestamp
    metadata: object         // Optional metadata
  }
}
```

### Message Format: EASL → Canvas
```typescript
{
  type: 'EASL_RESPONSE',
  payload: {
    response: string,        // The response text
    timestamp: string        // ISO timestamp
  }
}
```

### Security
- Origin validation: Only accepts messages from `https://easl-board.vercel.app/`
- Iframe sandbox: `allow-scripts allow-same-origin allow-forms allow-popups`

## How to Restore

### Step 1: Uncomment Board Item JSON
In both `src/data/boardItems.json` and `api/data/boardItems.json`, uncomment the iframe item object.

### Step 2: Uncomment Canvas.tsx Code
In `src/components/Canvas.tsx`:
1. Uncomment the `sendQueryToEASL` function and its global exposure (lines ~399-426)
2. Uncomment the `handleEASLResponse` listener (lines ~429-449)

### Step 3: Uncomment BoardItem.tsx Rendering
In `src/components/BoardItem.tsx`, uncomment the iframe case in the `renderContent()` switch statement (lines ~849-872).

### Step 4: Uncomment Server Endpoints
In all three server files (`api/server.js`, `api/server-vercel.js`, `api/server-redis.js`):
1. Uncomment `POST /api/send-to-easl`
2. Uncomment `PUT /api/board-items/iframe-item-easl-interface`
3. Uncomment `GET /api/board-items/iframe-item-easl-interface`

### Step 5: Test the Integration
1. Start the backend server
2. Start the frontend
3. Navigate to the canvas board
4. Locate the EASL iframe (coordinates: x=-2100, y=100 or x=6500, y=100)
5. Test sending queries using: `window.sendQueryToEASL("test query")`
6. Verify messages are received in the iframe

## Usage Examples

### Send Query from Console
```javascript
window.sendQueryToEASL("What is the patient's diagnosis?", {
  patientId: "12345",
  context: "clinical review"
});
```

### Send Query from Voice Agent API
```bash
curl -X POST http://localhost:3001/api/send-to-easl \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me the latest lab results",
    "metadata": {
      "source": "voice-agent",
      "meetingId": "abc-123"
    }
  }'
```

## Related Documentation
- **VOICE_TO_EASL_INTEGRATION.md** - Voice agent integration with EASL
- **EASL_RESPONSE_API.md** - EASL response API documentation
- **AGENT_ZONE_PARAMETER.md** - Zone configuration including web-interface-zone

## External Dependencies
- **EASL Application URL:** `https://easl-board.vercel.app/`
- **Communication Method:** postMessage API
- **Transport:** Server-Sent Events (SSE) for backend-to-frontend

## Notes
- The iframe is positioned in the "web-interface-zone" (far left of canvas)
- The chatbot maintains conversation history in `conversationHistory` array
- All communication is logged to console for debugging
- The iframe uses sandbox restrictions for security

---
**Last Updated:** October 31, 2025
**Status:** Commented Out
**Restoration Difficulty:** Easy (just uncomment code)
