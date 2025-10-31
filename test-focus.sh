#!/bin/bash

# Test Focus Function
# This script tests the focus API endpoint

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing Focus Function ===${NC}\n"

# Configuration
API_URL="http://localhost:3001"
SESSION_ID="${1:-test-session-123}"

echo -e "${YELLOW}Using Session ID: ${SESSION_ID}${NC}\n"

# Step 1: Get board items to find an item ID
echo -e "${BLUE}1. Getting board items...${NC}"
ITEMS=$(curl -s "${API_URL}/api/board-items?sessionId=${SESSION_ID}")
echo "$ITEMS" | jq '.'

# Extract first item ID
ITEM_ID=$(echo "$ITEMS" | jq -r '.items[0].id // .items[0].id // "ehr-patient-001"')
echo -e "\n${GREEN}Found item ID: ${ITEM_ID}${NC}\n"

# Step 2: Focus on the item
echo -e "${BLUE}2. Focusing on item: ${ITEM_ID}${NC}"
curl -X POST "http://localhos/api/focus" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: ${SESSION_ID}" \
  -d '{
    "itemId": "'${ITEM_ID}'",
    "focusOptions": {
      "zoom": 1.2,
      "duration": 1500
    }
  }' | jq '.'


curl -X POST http://localhost:3001/api/focus \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 316e03fc-e4b0-4bb8-9577-cc6e8de1f765" \
  -d '{
    "itemId": "dashboard-item-1759906076097-medication-timeline",
    "focusOptions": {
      "zoom": 1.2,
      "duration": 1500
    }
  }'



echo -e "\n${GREEN}✓ Focus request sent!${NC}"
echo -e "${YELLOW}Check your browser - the board should focus on the item${NC}\n"

# Step 3: Focus on a sub-element (if it's an EHR item)
echo -e "${BLUE}3. Testing sub-element focus (for EHR items)...${NC}"
curl -X POST "${API_URL}/api/focus" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: ${SESSION_ID}" \
  -d '{
    "itemId": "'${ITEM_ID}'",
    "subElement": "chief_complaint",
    "focusOptions": {
      "zoom": 1.5,
      "duration": 2000
    }
  }' | jq '.'

echo -e "\n${GREEN}✓ Sub-element focus request sent!${NC}\n"

# Usage instructions
echo -e "${BLUE}=== Usage ===${NC}"
echo "Run with custom session ID:"
echo "  ./test-focus.sh your-session-id"
echo ""
echo "Or use default:"
echo "  ./test-focus.sh"
