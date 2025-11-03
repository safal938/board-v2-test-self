# Quick Deploy Guide

## Deploy Now

```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod
```

## Test After Deploy

### Test in Browser
```bash
# Open in browser
open https://board-v25.vercel.app/

# Should see: 📡 Live Updates badge
```

### Test in Google Meet
1. Join a Google Meet
2. Launch add-on: `https://board-v25.vercel.app/meet/Mainstage`
3. Have AI agent create an item
4. Item should appear in real-time

## Verify It's Working

### Check Console Logs

```
🔌 Using SSE mode
✅ Connected to SSE
```

### Check Network Tab

- Should see persistent connection to `/api/events`

## How It Works

### Flow
```
Agent → API → Redis → SSE → Frontend (real-time)
```

## That's It!

The app uses Server-Sent Events (SSE) for real-time updates across all clients.
