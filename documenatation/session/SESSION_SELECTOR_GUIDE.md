# Session Selector - User Guide

## 🎯 What's New

Your board now has a **Session Selector** screen that appears first, allowing users to:
- ✨ Create a new session
- 🚪 Join an existing session
- 📋 Quickly rejoin recent sessions

## 🖼️ What It Looks Like

When you open the app at `http://localhost:3000`, you'll see:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                      🎯                         │
│              MedForce Board                     │
│     Collaborative medical board for meetings    │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  ✨ Create New Session                    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│                    or                           │
│                                                 │
│  Join Existing Session                          │
│  ┌───────────────────────────────────────────┐ │
│  │ Enter session ID...                       │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  🚪 Join Session                          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  📋 Recent Sessions                             │
│  ┌───────────────────────────────────────────┐ │
│  │ meet-abc-defg-hij                         │ │
│  │ 5 minutes ago                             │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 🚀 User Flows

### Flow 1: Create New Session

1. User opens `http://localhost:3000`
2. Sees session selector screen
3. Clicks **"✨ Create New Session"**
4. System creates a new session ID
5. URL updates to `http://localhost:3000?sessionId=abc-123...`
6. Board loads with empty state (only static items)
7. User can share this URL with others

### Flow 2: Join Existing Session

1. User receives a session URL from colleague: `http://localhost:3000?sessionId=meet-abc-defg-hij`
2. Opens the URL
3. Board loads directly with that session's items
4. User sees the same board as their colleague

### Flow 3: Join via Session ID

1. User opens `http://localhost:3000`
2. Sees session selector screen
3. Types or pastes session ID: `meet-abc-defg-hij`
4. Clicks **"🚪 Join Session"**
5. Board loads with that session's items

### Flow 4: Rejoin Recent Session

1. User opens `http://localhost:3000`
2. Sees session selector screen
3. Sees list of recent sessions
4. Clicks on a recent session
5. Session ID auto-fills in the input
6. Clicks **"🚪 Join Session"** or presses Enter
7. Board loads with that session's items

### Flow 5: Leave Session

1. User is in a board session
2. Clicks **"🚪 Leave Session"** button (top-left, below session ID)
3. Confirms they want to leave
4. Returns to session selector screen
5. Can create new session or join another

## 🎨 UI Elements

### On Session Selector Screen

| Element | Description |
|---------|-------------|
| **Create New Session** | Blue button - creates a new isolated board |
| **Session ID Input** | Text field to enter existing session ID |
| **Join Session** | Gray button - joins the entered session |
| **Recent Sessions** | List of last 5 sessions (if any) |

### On Board Screen

| Element | Location | Description |
|---------|----------|-------------|
| **Session ID** | Top-left | Shows current session (click to copy) |
| **Leave Session** | Below session ID | Red button to exit session |
| **Connection Status** | Top-right | Shows SSE/Polling status |

## 💡 Features

### Recent Sessions
- Automatically saves last 5 sessions
- Shows how long ago you accessed each
- Click to auto-fill session ID
- Stored in browser localStorage

### Session ID Formats
- **Auto-generated**: `550e8400-e29b-41d4-a716-446655440000`
- **Meeting-based**: `meet-abc-defg-hij`
- **Custom**: Any string you want

### URL Sharing
- Session ID is in the URL: `?sessionId=abc-123`
- Share URL to invite others to your board
- Direct links bypass session selector

## 🧪 Testing

### Test 1: Create and Share
```bash
# 1. Open browser
http://localhost:3000

# 2. Click "Create New Session"
# 3. Copy the URL from address bar
# 4. Open in new incognito window
# 5. Both windows show same board
```

### Test 2: Join Specific Session
```bash
# 1. Open browser
http://localhost:3000

# 2. Enter session ID from test script:
edd70fbf-c959-4436-a2db-12f010f6b99a

# 3. Click "Join Session"
# 4. Should see Session A items (with agent note)
```

### Test 3: Recent Sessions
```bash
# 1. Create or join 3 different sessions
# 2. Leave each session
# 3. Return to session selector
# 4. Should see all 3 in "Recent Sessions"
# 5. Click one to rejoin
```

### Test 4: Leave Session
```bash
# 1. Join any session
# 2. Click "Leave Session" button
# 3. Confirm
# 4. Should return to session selector
# 5. Session should appear in recent list
```

## 🔧 Technical Details

### Session Storage
- **URL**: `?sessionId=abc-123` (for sharing)
- **localStorage**: `boardSessionId` (for recent sessions)
- **Recent sessions**: `recentSessions` array in localStorage

### Session Lifecycle
1. **No URL param** → Show session selector
2. **URL param exists** → Auto-join that session
3. **Leave session** → Clear URL, show selector
4. **Create session** → Generate ID, update URL
5. **Join session** → Validate ID, update URL

### Error Handling
- Invalid session ID → Shows error message
- Network error → Shows error message
- Empty input → Disables join button

## 🎯 Use Cases

### Use Case 1: Medical Team Meeting
```
1. Doctor opens app, creates new session
2. Shares URL in Google Meet chat
3. Team members click URL, join same board
4. AI agent joins with same session ID
5. Everyone sees same items in real-time
```

### Use Case 2: Multiple Concurrent Meetings
```
Meeting A: http://localhost:3000?sessionId=meet-abc-defg-hij
Meeting B: http://localhost:3000?sessionId=meet-xyz-uvwx-rst
Meeting C: http://localhost:3000?sessionId=meet-123-4567-890

Each meeting has isolated board state
```

### Use Case 3: Development & Testing
```
Developer 1: Creates session "dev-feature-a"
Developer 2: Creates session "dev-feature-b"

Each tests their feature independently
No interference between sessions
```

## 📱 Mobile Considerations

The session selector is responsive and works on mobile:
- Touch-friendly buttons
- Large input fields
- Scrollable recent sessions list
- Gradient background adapts to screen size

## 🔐 Security Notes

- Session IDs are not encrypted
- Anyone with the session ID can join
- No authentication required
- Sessions expire after 24 hours (Redis)
- Use meeting-specific IDs for privacy

## 🚀 Next Steps

1. **Test the new UI** - Open `http://localhost:3000`
2. **Create a session** - Click "Create New Session"
3. **Share with team** - Copy URL and share
4. **Test isolation** - Open multiple sessions
5. **Update agent** - Ensure agent uses correct session ID

## 💬 User Feedback

The session selector provides clear feedback:
- ✅ Success messages (green)
- ❌ Error messages (red)
- ⏳ Loading states
- 📋 Recent sessions with timestamps

## 🎨 Customization

To customize the session selector:
- Edit `src/components/SessionSelector.tsx`
- Change colors, fonts, layout
- Add company logo
- Modify button text
- Add additional fields

---

**Ready to use?** Just open `http://localhost:3000` and you'll see the new session selector!
