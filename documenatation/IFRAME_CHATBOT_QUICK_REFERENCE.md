# EASL Iframe Chatbot - Quick Reference

## Status: COMMENTED OUT ❌

The EASL iframe chatbot integration has been temporarily disabled. All related code has been commented out with clear markers.

## What Was Disabled

### Frontend Components
- ✅ `src/components/Canvas.tsx` - Communication logic (lines ~399-449)
- ✅ `src/components/BoardItem.tsx` - Iframe rendering (lines ~849-872)
- ✅ `src/data/boardItems.json` - Iframe board item
- ✅ `api/data/boardItems.json` - Iframe board item

### Backend API Endpoints
- ✅ `api/server.js` - All 3 EASL endpoints
- ✅ `api/server-vercel.js` - All 3 EASL endpoints  
- ✅ `api/server-redis.js` - All 3 EASL endpoints

**Endpoints disabled:**
1. `POST /api/send-to-easl` - Send query to iframe
2. `POST /api/easl-response` - Receive response from iframe
3. `GET /api/easl-history` - Get conversation history

## Quick Restore

To restore the chatbot, search for this comment in all files:
```
EASL IFRAME CHATBOT - COMMENTED OUT
```

Then:
1. Uncomment all code blocks marked with this comment
2. In JSON files, add a comma after the last item and uncomment the iframe object
3. Restart your servers

## Full Documentation

See `IFRAME_CHATBOT_RESTORATION_GUIDE.md` for complete restoration instructions.

## External App

The chatbot connects to: `https://easl-board.vercel.app/`

---
**Date Disabled:** October 31, 2025  
**Reason:** Temporary removal per user request  
**Restoration Time:** ~5 minutes
