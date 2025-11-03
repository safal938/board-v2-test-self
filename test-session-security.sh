#!/bin/bash

# Test Session Security Fix
# This script demonstrates that session ID is now required

API_URL="http://localhost:3001"

echo "========================================="
echo "Testing Session Security Fix"
echo "========================================="
echo ""

echo "❌ Test 1: Try to access board items WITHOUT session ID (should fail)"
echo "Command: curl $API_URL/api/board-items"
echo ""
curl -s $API_URL/api/board-items | jq '.'
echo ""
echo "Expected: Error message requiring session ID"
echo ""

echo "========================================="
echo ""

echo "✅ Test 2: Create a new session"
echo "Command: curl -X POST $API_URL/api/session/create"
echo ""
SESSION_RESPONSE=$(curl -s -X POST $API_URL/api/session/create)
echo "$SESSION_RESPONSE" | jq '.'
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
echo ""
echo "Session ID: $SESSION_ID"
echo ""

echo "========================================="
echo ""

echo "✅ Test 3: Access board items WITH session ID (should work)"
echo "Command: curl -H 'X-Session-Id: $SESSION_ID' $API_URL/api/board-items"
echo ""
curl -s -H "X-Session-Id: $SESSION_ID" $API_URL/api/board-items | jq '.sessionId, .itemCount'
echo ""
echo "Expected: Session data returned successfully"
echo ""

echo "========================================="
echo ""

echo "✅ Test 4: Create a todo WITH session ID (should work)"
echo "Command: curl -X POST -H 'X-Session-Id: $SESSION_ID' $API_URL/api/todos ..."
echo ""
curl -s -X POST \
  -H "X-Session-Id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Todo",
    "description": "Testing session security",
    "todo_items": ["Task 1", "Task 2"]
  }' \
  $API_URL/api/todos | jq '.sessionId, .item.id, .item.todoData.title'
echo ""
echo "Expected: Todo created successfully"
echo ""

echo "========================================="
echo ""

echo "❌ Test 5: Try to create a todo WITHOUT session ID (should fail)"
echo "Command: curl -X POST $API_URL/api/todos ..."
echo ""
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Todo",
    "todo_items": ["Task 1"]
  }' \
  $API_URL/api/todos | jq '.'
echo ""
echo "Expected: Error message requiring session ID"
echo ""

echo "========================================="
echo "Tests Complete!"
echo "========================================="
