# Google Meet Add-on: SSE vs Polling

## Problem

Google Meet Add-ons run in a **sandboxed iframe** with strict Content Security Policy (CSP) that **blocks EventSource/SSE connections**. This prevents real-time updates when the AI agent creates items via API calls.

### Why SSE Doesn't Work in Meet Add-ons

1. **CSP Restrictions** - Google Meet blocks `EventSource` API
2. **Sandboxed iframe** - Limited network access
3. **Cross-origin restrictions** - Even with CORS, some features are blocked

## Solution: Automatic Mode Detection

The app now **automatically detects** if it's running in a Meet Add-on and switches between:

- **SSE Mode** (Browser) - Real-time Server-Sent Events
- **Polling Mode** (Meet Add-on) - Regular HTTP polling every 2 seconds

### Implementation

```typescript
// Detect if we're in Google Meet Add-on context
const isInMeetAddon = window.location.pathname.includes('/meet/');

// Use polling for Meet Add-ons, SSE for regular browser
if (isInMeetAddon) {
  console.log("🔄 Using polling mode (Meet Add-on detected)");
  // Poll every 2 seconds
  pollingInterval = setInterval(pollForUpdates, 2000);
} else {
  console.log("🔌 Using SSE mode (regular browser)");
  // Connect to SSE endpoint
  es = new EventSource(`${API_BASE_URL}/api/events`);
}
```

## How It Works

### Regular Browser (SSE Mode) 📡

```
Agent creates item via API
    ↓
Server saves to Redis
    ↓
Server broadcasts SSE event
    ↓
Frontend receives event instantly
    ↓
UI updates in real-time
```

### Meet Add-on (Polling Mode) 🔄

```
Agent creates item via API
    ↓
Server saves to Redis
    ↓
Frontend polls every 2 seconds
    ↓
Detects new items
    ↓
UI updates (2-second delay max)
```

## Visual Indicator

The app shows a status badge in the top-right corner:

- **📡 Live Updates (SSE)** - Green badge (regular browser)
- **🔄 Polling Mode (Meet)** - Yellow badge (Meet Add-on)

## Polling Details

### Polling Function

```typescript
const pollForUpdates = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/board-items`);
    const allItems = await response.json();
    
    // Check if new items were added
    if (allItems.length > lastItemCount) {
      // Find new items
      const currentIds = new Set(items.map((it: any) => it.id));
      const newItems = allItems.filter((item: any) => !currentIds.has(item.id));
      
      if (newItems.length > 0) {
        setItems(allItems);
        
        // Auto-focus on the newest item
        const newestItem = newItems[newItems.length - 1];
        setTimeout(() => {
          if ((window as any).centerOnItem) {
            (window as any).centerOnItem(newestItem.id, zoomLevel, 1200);
          }
        }, 500);
      }
    }
    
    lastItemCount = allItems.length;
  } catch (error) {
    console.error("❌ Polling error:", error);
  }
};
```

### Polling Interval

- **Frequency**: Every 2 seconds
- **Efficient**: Only updates when new items detected
- **Auto-focus**: Automatically centers on new items

## Performance Comparison

| Feature | SSE Mode | Polling Mode |
|---------|----------|--------------|
| Latency | Instant | 0-2 seconds |
| Network | Persistent connection | Request every 2s |
| Efficiency | High | Medium |
| Compatibility | Browser only | Works everywhere |
| Battery | Better | Slightly worse |

## Testing

### Test in Browser (SSE Mode)

1. Open: `https://board-v25.vercel.app/`
2. Check console: `🔌 Using SSE mode (regular browser)`
3. See badge: **📡 Live Updates (SSE)**
4. Agent creates item → Updates instantly

### Test in Meet Add-on (Polling Mode)

1. Open Google Meet
2. Launch add-on: `https://board-v25.vercel.app/meet/Mainstage`
3. Check console: `🔄 Using polling mode (Meet Add-on detected)`
4. See badge: **🔄 Polling Mode (Meet)**
5. Agent creates item → Updates within 2 seconds

## Troubleshooting

### Items Not Appearing in Meet Add-on

1. **Check console logs**:
   ```
   🔄 Using polling mode (Meet Add-on detected)
   📦 Polling detected X new items
   ✅ Adding X new items from polling
   ```

2. **Verify API endpoint**:
   - Open DevTools → Network tab
   - Look for `/api/board-items` requests every 2 seconds
   - Check response contains items

3. **Check Redis**:
   ```bash
   curl https://board-v25.vercel.app/api/health
   ```
   Should show: `"storage": "redis (persistent)"`

### Polling Not Working

1. **Check URL detection**:
   ```javascript
   console.log(window.location.pathname); // Should include '/meet/'
   ```

2. **Verify polling interval**:
   - Should see network requests every 2 seconds
   - Check browser DevTools → Network tab

3. **Check CORS**:
   - Polling uses regular fetch, should work with CORS
   - Verify API has CORS headers

## Configuration

### Adjust Polling Interval

Edit `src/App.tsx`:

```typescript
// Change from 2000ms (2 seconds) to desired interval
pollingInterval = setInterval(pollForUpdates, 2000);
```

**Recommendations**:
- **1000ms (1s)** - More responsive, higher network usage
- **2000ms (2s)** - Balanced (current default)
- **5000ms (5s)** - Lower network usage, slower updates

### Disable Auto-Focus

```typescript
// Comment out auto-focus in pollForUpdates
// setTimeout(() => {
//   if ((window as any).centerOnItem) {
//     (window as any).centerOnItem(newestItem.id, zoomLevel, 1200);
//   }
// }, 500);
```

## Benefits

✅ **Automatic detection** - No manual configuration needed
✅ **Works everywhere** - Browser and Meet Add-ons
✅ **Visual feedback** - Status badge shows current mode
✅ **Efficient** - Only polls when in Meet Add-on
✅ **Reliable** - Fallback for SSE restrictions

## Summary

The app now **automatically adapts** to its environment:

- **Browser**: Uses SSE for instant real-time updates
- **Meet Add-on**: Uses polling to work around CSP restrictions

This ensures the AI agent workflow works seamlessly in both contexts, with the Meet Add-on receiving updates within 2 seconds of item creation.
