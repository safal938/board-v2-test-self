# Deployment Checklist - Session ID Fix

## Pre-Deployment

- [x] Code changes made to `api/server-redis-sessions.js`
- [x] Session middleware updated to accept both formats
- [x] Documentation created
- [x] Test script created
- [ ] Local testing completed
- [ ] Code reviewed

## Files Changed

### Backend

- [x] `api/server-redis-sessions.js` - Session middleware fix

### Documentation

- [x] `documenatation/AGENT_SESSION_GUIDE.md` - Complete guide
- [x] `documenatation/SESSION_ID_FIX_DIAGRAM.md` - Visual diagrams
- [x] `AGENT_SESSION_FIX.md` - Detailed explanation
- [x] `AGENT_QUICK_FIX.md` - Quick reference
- [x] `SESSION_ID_COMPATIBILITY_UPDATE.md` - Update summary

### Testing

- [x] `test-agent-session.sh` - Automated test script

## Local Testing

### 1. Start Local Server

```bash
cd api
node server-redis-sessions.js
# Should see: 🚀 Server running on port 3001
```

### 2. Run Automated Test

```bash
./test-agent-session.sh
# Should see: ✅ All tests PASSED
```

### 3. Manual Test - snake_case

```bash
SESSION_ID="test-$(date +%s)"

curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'$SESSION_ID'",
    "title": "Test Todo",
    "todo_items": ["Task 1"]
  }'

# Should return: { "sessionId": "test-...", "item": {...} }
```

### 4. Manual Test - camelCase

```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "title": "Test Todo 2",
    "todo_items": ["Task 2"]
  }'

# Should return: { "sessionId": "test-...", "item": {...} }
```

### 5. Verify Items in Same Session

```bash
curl "http://localhost:3001/api/board-items?session_id=$SESSION_ID"

# Should return: { "items": [...], "count": 2 }
```

## Git Commit

```bash
# Stage changes
git add api/server-redis-sessions.js
git add documenatation/AGENT_SESSION_GUIDE.md
git add documenatation/SESSION_ID_FIX_DIAGRAM.md
git add AGENT_SESSION_FIX.md
git add AGENT_QUICK_FIX.md
git add SESSION_ID_COMPATIBILITY_UPDATE.md
git add DEPLOYMENT_CHECKLIST.md
git add test-agent-session.sh

# Commit
git commit -m "fix: accept session_id (snake_case) for agent compatibility

- Updated session middleware to accept both sessionId and session_id
- Added comprehensive documentation for agent developers
- Created automated test script
- Fixes issue where agent items weren't appearing on board
- Backward compatible with existing frontend code"

# Push
git push origin main
```

## Vercel Deployment

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Monitor Vercel Deployment

- Go to: https://vercel.com/dashboard
- Check deployment status
- Wait for "Ready" status

### 3. Check Deployment Logs

- Look for any errors
- Verify build succeeded

## Production Testing

### 1. Test snake_case Format

```bash
curl -X POST https://board-v25.vercel.app/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "prod-test-123",
    "title": "Production Test",
    "todo_items": ["Task 1"]
  }'

# Expected: { "sessionId": "prod-test-123", "item": {...} }
```

### 2. Test camelCase Format

```bash
curl -X POST https://board-v25.vercel.app/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "prod-test-123",
    "title": "Production Test 2",
    "todo_items": ["Task 2"]
  }'

# Expected: { "sessionId": "prod-test-123", "item": {...} }
```

### 3. Verify Items

```bash
curl "https://board-v25.vercel.app/api/board-items?session_id=prod-test-123"

# Expected: { "items": [...], "count": 2 }
```

### 4. Test with Frontend

1. Open: https://patientcanvas-ai.vercel.app
2. Note the session ID from URL or localStorage
3. Use that session ID in curl test
4. Verify item appears on board immediately

## Agent Testing

### 1. Agent Joins Meeting

- Agent should receive session_id from join-meeting API
- Agent should store session_id

### 2. Agent Creates Items

```python
# Agent code (no changes needed)
agent.create_todo(
    title="Test from Agent",
    items=["Task 1", "Task 2"]
)
```

### 3. Verify on Board

- Open board in browser with same session ID
- Item should appear immediately
- Item should auto-focus
- Voice should say "I'm adding this to the board"

## Verification Checklist

### Backend

- [ ] Server starts without errors
- [ ] Session middleware accepts snake_case
- [ ] Session middleware accepts camelCase
- [ ] Items stored in correct session
- [ ] SSE broadcasts to correct session

### Frontend

- [ ] Board loads correctly
- [ ] SSE connection established
- [ ] New items appear via SSE
- [ ] Items auto-focus correctly
- [ ] No console errors

### Agent

- [ ] Agent receives session_id on join
- [ ] Agent creates todos successfully
- [ ] Agent creates agent results successfully
- [ ] Agent creates lab results successfully
- [ ] Items appear on board immediately
- [ ] Voice confirmation matches visual

### Integration

- [ ] Agent + Frontend in same session
- [ ] Items sync in real-time
- [ ] Multiple agents can join same session
- [ ] Session isolation works correctly

## Rollback Plan

If issues occur:

### 1. Revert Git Commit

```bash
git revert HEAD
git push origin main
```

### 2. Vercel Auto-Deploys

- Vercel will automatically deploy the revert
- Previous version will be restored

### 3. Alternative: Manual Rollback

- Go to Vercel Dashboard
- Select previous deployment
- Click "Promote to Production"

## Post-Deployment

### 1. Monitor Logs

```bash
# Check Vercel logs for errors
vercel logs --follow
```

### 2. Monitor Sentry (if configured)

- Check for new errors
- Monitor error rate

### 3. Test with Real Agent

- Have agent join a real meeting
- Create various item types
- Verify all appear correctly

### 4. Update Agent Documentation

- Notify agent developers
- Share AGENT_QUICK_FIX.md
- Confirm no code changes needed

## Success Criteria

- [x] Code deployed to production
- [ ] Automated tests pass
- [ ] Manual tests pass
- [ ] Agent can create items
- [ ] Items appear on board
- [ ] No errors in logs
- [ ] Frontend still works
- [ ] Backward compatible

## Communication

### To Agent Developers

```
✅ Session ID fix deployed!

The backend now accepts session_id (snake_case) in addition to sessionId (camelCase).

Your agent code doesn't need any changes - it will work automatically.

See AGENT_QUICK_FIX.md for details.
```

### To Frontend Developers

```
✅ Session ID compatibility update deployed

No changes needed in frontend code. The backend now accepts both:
- sessionId (camelCase) - existing format
- session_id (snake_case) - for agent compatibility

Everything continues to work as before.
```

## Notes

- **Backward Compatible**: No breaking changes
- **Zero Downtime**: Vercel handles deployment
- **No Agent Changes**: Agent code works as-is
- **No Frontend Changes**: Frontend code works as-is

## Support

If issues occur:

1. Check Vercel logs
2. Check browser console
3. Check agent logs
4. Review SESSION_ID_FIX_DIAGRAM.md
5. Run test-agent-session.sh locally

## Completion

- [ ] All tests passed
- [ ] Production verified
- [ ] Agent tested
- [ ] Documentation shared
- [ ] Team notified
- [ ] Checklist archived

---

**Deployed by**: [Your Name]  
**Date**: [Date]  
**Status**: [ ] Ready / [ ] In Progress / [ ] Complete
