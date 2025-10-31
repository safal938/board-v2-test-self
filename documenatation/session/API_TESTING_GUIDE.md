# API Testing Guide - Session-Based Board

## 🚀 Quick Start

### 1. Start the Server

```bash
npm run server-sessions
```

### 2. Set Your Session ID

```bash
# Create a new session or use an existing one
export SESSION_ID="test-session-$(date +%s)"
echo "Using session: $SESSION_ID"
```

## 📋 All Available Endpoints

### Session Management

#### Create/Get Session

```bash
curl http://localhost:3001/api/session
```

#### Get Session Info

```bash
curl "http://localhost:3001/api/session?sessionId=$SESSION_ID"
```

#### Clear Session

```bash
curl -X DELETE \
  -H "X-Session-Id: $SESSION_ID" \
  http://localhost:3001/api/session
```

### Board Items

#### Get All Board Items

```bash
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_ID"
```

#### Create Generic Board Item

```bash
curl -X POST http://localhost:3001/api/board-items \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "type": "sticky",
    "x": 1000,
    "y": 1000,
    "width": 200,
    "height": 200,
    "content": "My sticky note",
    "color": "#ffeb3b"
  }'
```

#### Update Board Item

```bash
# First, get an item ID from the board
ITEM_ID="item-123"

curl -X PUT "http://localhost:3001/api/board-items/$ITEM_ID" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "content": "Updated content",
    "x": 1500,
    "y": 1500
  }'
```

#### Delete Board Item

```bash
ITEM_ID="item-123"

curl -X DELETE "http://localhost:3001/api/board-items/$ITEM_ID" \
  -H "X-Session-Id: $SESSION_ID"
```

## 🎯 Create Specific Item Types

### 1. Create TODO List

#### Simple TODO

```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Patient Care Tasks",
    "description": "Daily patient care checklist",
    "todo_items": [
      "Check vital signs",
      "Administer medication",
      "Update patient chart",
      "Schedule follow-up"
    ]
  }'
```

#### TODO with Status

```bash
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Lab Work",
    "description": "Required lab tests",
    "todo_items": [
      {"text": "Blood test", "status": "done"},
      {"text": "Urine analysis", "status": "in_progress"},
      {"text": "X-ray", "status": "todo"}
    ]
  }'
```

### 2. Create Enhanced TODO (with Agent Delegation)

```bash
curl -X POST http://localhost:3001/api/enhanced-todo \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Treatment Plan",
    "description": "Patient treatment workflow",
    "todos": [
      {
        "text": "Review patient history",
        "status": "finished",
        "agent": "Dr. Smith",
        "subTodos": [
          {"text": "Check previous visits", "status": "finished"},
          {"text": "Review medications", "status": "finished"}
        ]
      },
      {
        "text": "Order lab tests",
        "status": "executing",
        "agent": "Lab Tech",
        "subTodos": [
          {"text": "Blood work", "status": "finished"},
          {"text": "Imaging", "status": "pending"}
        ]
      },
      {
        "text": "Schedule follow-up",
        "status": "pending",
        "agent": "Receptionist"
      }
    ]
  }'
```

### 3. Create Agent Note

#### Simple Agent Note

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "AI Analysis",
    "content": "Patient shows improvement in vital signs. Blood pressure normalized. Recommend continuing current treatment plan."
  }'
```

#### Agent Note in Specific Zone

```bash
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Clinical Summary",
    "content": "**Key Findings:**\n- BP: 120/80 (normal)\n- Heart rate: 72 bpm\n- Temperature: 98.6°F\n\n**Recommendations:**\n- Continue current medication\n- Follow-up in 2 weeks",
    "zone": "task-management-zone"
  }'
```

Available zones:

- `task-management-zone`
- `retrieved-data-zone`
- `doctors-note-zone`
- `adv-event-zone`
- `data-zone`
- `raw-ehr-data-zone`
- `web-interface-zone`

### 4. Create Lab Result

```bash
curl -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "parameter": "Blood Glucose",
    "value": 95,
    "unit": "mg/dL",
    "status": "optimal",
    "range": {
      "min": 70,
      "max": 100
    },
    "trend": "stable"
  }'
```

#### Multiple Lab Results

```bash
# Hemoglobin
curl -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "parameter": "Hemoglobin",
    "value": 13.5,
    "unit": "g/dL",
    "status": "optimal",
    "range": {"min": 12, "max": 16},
    "trend": "stable"
  }'

# White Blood Cell Count
curl -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "parameter": "WBC Count",
    "value": 11.5,
    "unit": "K/μL",
    "status": "warning",
    "range": {"min": 4, "max": 11},
    "trend": "increasing"
  }'

# Cholesterol
curl -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "parameter": "Total Cholesterol",
    "value": 240,
    "unit": "mg/dL",
    "status": "critical",
    "range": {"min": 0, "max": 200},
    "trend": "increasing"
  }'
```

Status options: `optimal`, `warning`, `critical`
Trend options: `stable`, `increasing`, `decreasing`

### 5. Create EHR Data

```bash
curl -X POST http://localhost:3001/api/ehr-data \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Patient Demographics",
    "content": "Name: John Doe\nAge: 45\nGender: Male\nMRN: 12345678",
    "dataType": "demographics",
    "source": "Epic EHR"
  }'
```

#### Clinical EHR Data

```bash
curl -X POST http://localhost:3001/api/ehr-data \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Current Medications",
    "content": "1. Lisinopril 10mg daily\n2. Metformin 500mg twice daily\n3. Atorvastatin 20mg at bedtime",
    "dataType": "medications",
    "source": "Pharmacy System"
  }'
```

### 6. Create Doctor's Note

```bash
curl -X POST http://localhost:3001/api/doctor-notes \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "content": "Patient presents with mild hypertension. Started on Lisinopril 10mg. Will monitor BP weekly. Follow-up in 2 weeks."
  }'
```

#### Detailed Doctor's Note

```bash
curl -X POST http://localhost:3001/api/doctor-notes \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "content": "**Chief Complaint:** Chest pain\n\n**History:** 55yo male with history of hypertension presents with intermittent chest pain for 2 days.\n\n**Physical Exam:**\n- BP: 145/90\n- HR: 88\n- Lungs: Clear\n- Heart: Regular rhythm\n\n**Assessment:** Possible angina\n\n**Plan:**\n1. EKG\n2. Cardiac enzymes\n3. Cardiology consult\n4. Admit for observation"
  }'
```

## 🎯 Focus on Items

### Focus on Specific Item

```bash
# Get an item ID first, then focus on it
ITEM_ID="item-1234567890-abc123"

curl -X POST http://localhost:3001/api/focus \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "itemId": "'$ITEM_ID'",
    "focusOptions": {
      "zoom": 1.2,
      "duration": 1500
    }
  }'
```

### Focus on Sub-Element

```bash
curl -X POST http://localhost:3001/api/focus \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "itemId": "'$ITEM_ID'",
    "subElement": "task-1",
    "focusOptions": {
      "zoom": 1.5,
      "duration": 2000,
      "highlight": true
    }
  }'
```

## 🧪 Complete Test Scenarios

### Scenario 1: Patient Intake Workflow

```bash
# Set session
export SESSION_ID="patient-intake-$(date +%s)"

# 1. Create patient demographics
curl -X POST http://localhost:3001/api/ehr-data \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: 316e03fc-e4b0-4bb8-9577-cc6e8de1f765" \
  -d '{
    "title": "Patient: Sarah Miller",
    "content": "Age: 63\nSex: Female\nMRN: P001\nOccupation: Retired carpenter",
    "dataType": "demographics"
  }'

# 2. Create intake checklist
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Intake Checklist",
    "todo_items": [
      "Verify insurance",
      "Take vital signs",
      "Review medications",
      "Update allergies"
    ]
  }'

# 3. Add doctor's note
curl -X POST http://localhost:3001/api/doctor-notes \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "content": "New patient intake. Chief complaint: Joint pain and swelling."
  }'

# 4. View all items
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_ID" | jq '.items | length'
```

### Scenario 2: Lab Results Review

```bash
export SESSION_ID="lab-review-$(date +%s)"

# Add multiple lab results
curl -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"parameter": "Glucose", "value": 95, "unit": "mg/dL", "status": "optimal", "range": {"min": 70, "max": 100}}'

curl -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"parameter": "Hemoglobin", "value": 13.5, "unit": "g/dL", "status": "optimal", "range": {"min": 12, "max": 16}}'

curl -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"parameter": "Cholesterol", "value": 240, "unit": "mg/dL", "status": "critical", "range": {"min": 0, "max": 200}}'

# Add AI analysis
curl -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Lab Analysis",
    "content": "**Findings:**\n- Glucose: Normal\n- Hemoglobin: Normal\n- Cholesterol: ELEVATED\n\n**Recommendation:** Start statin therapy"
  }'
```

### Scenario 3: Treatment Plan

```bash
export SESSION_ID="treatment-plan-$(date +%s)"

# Create enhanced todo with agent delegation
curl -X POST http://localhost:3001/api/enhanced-todo \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "title": "Hypertension Treatment Plan",
    "description": "Comprehensive treatment workflow",
    "todos": [
      {
        "text": "Initial Assessment",
        "status": "finished",
        "agent": "Dr. Johnson",
        "subTodos": [
          {"text": "BP measurement", "status": "finished"},
          {"text": "Patient history", "status": "finished"}
        ]
      },
      {
        "text": "Medication Management",
        "status": "executing",
        "agent": "Pharmacist",
        "subTodos": [
          {"text": "Prescribe Lisinopril", "status": "finished"},
          {"text": "Patient education", "status": "pending"}
        ]
      },
      {
        "text": "Follow-up Care",
        "status": "pending",
        "agent": "Nurse Practitioner",
        "subTodos": [
          {"text": "Schedule 2-week follow-up", "status": "pending"},
          {"text": "BP monitoring instructions", "status": "pending"}
        ]
      }
    ]
  }'
```

## 🔍 Monitoring & Debugging

### Check Server Health

```bash
curl http://localhost:3001/api/health | jq
```

### List All Endpoints

```bash
curl http://localhost:3001/api | jq
```

### Get Session Info

```bash
curl "http://localhost:3001/api/session?sessionId=$SESSION_ID" | jq
```

### Count Items in Session

```bash
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_ID" | jq '.items | length'
```

### List All Item Types

```bash
curl "http://localhost:3001/api/board-items?sessionId=$SESSION_ID" | jq '.items | group_by(.type) | map({type: .[0].type, count: length})'
```

## 🎨 Testing Real-Time Updates

### Terminal 1: Watch SSE Events

```bash
curl -N "http://localhost:3001/api/events?sessionId=$SESSION_ID"
```

### Terminal 2: Create Items

```bash
# Create a todo
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"title": "Test", "todo_items": ["Item 1"]}'

# You should see the event in Terminal 1!
```

## 📊 Batch Testing Script

Save this as `test-all-endpoints.sh`:

```bash
#!/bin/bash

# Create session
export SESSION_ID="test-$(date +%s)"
echo "Testing with session: $SESSION_ID"

# Test each endpoint
echo "1. Creating TODO..."
curl -s -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"title": "Test TODO", "todo_items": ["Task 1"]}' | jq '.item.id'

echo "2. Creating Agent Note..."
curl -s -X POST http://localhost:3001/api/agents \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"title": "Test Agent", "content": "Test content"}' | jq '.item.id'

echo "3. Creating Lab Result..."
curl -s -X POST http://localhost:3001/api/lab-results \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"parameter": "Test", "value": 100, "unit": "mg/dL", "status": "optimal", "range": {"min": 0, "max": 200}}' | jq '.item.id'

echo "4. Creating EHR Data..."
curl -s -X POST http://localhost:3001/api/ehr-data \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"title": "Test EHR", "content": "Test data"}' | jq '.item.id'

echo "5. Creating Doctor Note..."
curl -s -X POST http://localhost:3001/api/doctor-notes \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"content": "Test note"}' | jq '.item.id'

echo "6. Getting all items..."
curl -s "http://localhost:3001/api/board-items?sessionId=$SESSION_ID" | jq '.items | length'

echo "Done! Session: $SESSION_ID"
```

Run it:

```bash
chmod +x test-all-endpoints.sh
./test-all-endpoints.sh
```

## 🎯 Quick Reference

| Endpoint               | Method | Purpose              |
| ---------------------- | ------ | -------------------- |
| `/api/session`         | GET    | Get/create session   |
| `/api/board-items`     | GET    | Get all items        |
| `/api/board-items`     | POST   | Create generic item  |
| `/api/board-items/:id` | PUT    | Update item          |
| `/api/board-items/:id` | DELETE | Delete item          |
| `/api/todos`           | POST   | Create TODO          |
| `/api/enhanced-todo`   | POST   | Create enhanced TODO |
| `/api/agents`          | POST   | Create agent note    |
| `/api/lab-results`     | POST   | Create lab result    |
| `/api/ehr-data`        | POST   | Create EHR data      |
| `/api/doctor-notes`    | POST   | Create doctor note   |
| `/api/focus`           | POST   | Focus on item        |
| `/api/events`          | GET    | SSE stream           |

---

**Happy Testing! 🎉**

Open your frontend at `http://localhost:3000?sessionId=$SESSION_ID` to see the items appear in real-time!
