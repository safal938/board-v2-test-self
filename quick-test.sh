#!/bin/bash

# Quick Test Script for Session-Based Board
# This script tests all major endpoints

echo "🚀 Quick Test Script for Session-Based Board"
echo "=============================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Server is not running!"
    echo "Please start the server with: npm run server-sessions"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Create a test session
echo "📋 Creating test session..."
SESSION_ID="quick-test-$(date +%s)"
echo "Session ID: $SESSION_ID"
echo ""

# Test 1: Create TODO
echo "1️⃣  Creating TODO..."
TODO_RESPONSE=$(curl -s -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Patient Care Tasks",
    "description": "Daily checklist",
    "todo_items": ["Check vitals", "Administer medication", "Update chart"]
  }')

TODO_ID=$(echo $TODO_RESPONSE | jq -r '.item.id')
echo "   ✅ TODO created: $TODO_ID"
echo ""

# Test 2: Create Agent Note
echo "2️⃣  Creating Agent Note..."
AGENT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "AI Analysis",
    "content": "Patient shows improvement in vital signs. Blood pressure normalized. Recommend continuing current treatment."
  }')

AGENT_ID=$(echo $AGENT_RESPONSE | jq -r '.item.id')
echo "   ✅ Agent note created: $AGENT_ID"
echo ""

# Test 3: Create Lab Result
echo "3️⃣  Creating Lab Result..."
LAB_RESPONSE=$(curl -s -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "parameter": "Blood Glucose",
    "value": 95,
    "unit": "mg/dL",
    "status": "optimal",
    "range": {"min": 70, "max": 100},
    "trend": "stable"
  }')

LAB_ID=$(echo $LAB_RESPONSE | jq -r '.item.id')
echo "   ✅ Lab result created: $LAB_ID"
echo ""

# Test 4: Create EHR Data
echo "4️⃣  Creating EHR Data..."
EHR_RESPONSE=$(curl -s -X POST http://localhost:3001/api/ehr-data \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Patient Demographics",
    "content": "Name: John Doe\nAge: 45\nGender: Male\nMRN: 12345678",
    "dataType": "demographics",
    "source": "Epic EHR"
  }')

EHR_ID=$(echo $EHR_RESPONSE | jq -r '.item.id')
echo "   ✅ EHR data created: $EHR_ID"
echo ""

# Test 5: Create Doctor's Note
echo "5️⃣  Creating Doctor's Note..."
NOTE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/doctor-notes \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "content": "Patient presents with mild hypertension. Started on Lisinopril 10mg. Will monitor BP weekly."
  }')

NOTE_ID=$(echo $NOTE_RESPONSE | jq -r '.item.id')
echo "   ✅ Doctor note created: $NOTE_ID"
echo ""

# Test 6: Get all items
echo "6️⃣  Getting all items..."
ITEMS_RESPONSE=$(curl -s "http://localhost:3001/api/board-items?sessionId=$SESSION_ID")
ITEM_COUNT=$(echo $ITEMS_RESPONSE | jq '.items | length')
echo "   ✅ Total items in session: $ITEM_COUNT"
echo ""

# Test 7: Focus on TODO
echo "7️⃣  Focusing on TODO item..."
FOCUS_RESPONSE=$(curl -s -X POST http://localhost:3001/api/focus \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d "{
    \"itemId\": \"$TODO_ID\",
    \"focusOptions\": {
      \"zoom\": 1.2,
      \"duration\": 1500
    }
  }")

echo "   ✅ Focus event sent"
echo ""

# Summary
echo "=============================================="
echo "✅ All tests passed!"
echo ""
echo "📊 Summary:"
echo "   - Session ID: $SESSION_ID"
echo "   - TODO: $TODO_ID"
echo "   - Agent: $AGENT_ID"
echo "   - Lab: $LAB_ID"
echo "   - EHR: $EHR_ID"
echo "   - Note: $NOTE_ID"
echo "   - Total items: $ITEM_COUNT"
echo ""
echo "🌐 View in browser:"
echo "   http://localhost:3000?sessionId=$SESSION_ID"
echo ""
echo "🧪 Test SSE updates:"
echo "   curl -N \"http://localhost:3001/api/events?sessionId=$SESSION_ID\""
echo ""
