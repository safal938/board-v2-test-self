# MedForce AI - Patient Canvas & Adverse Event Dashboard

A modern collaborative medical dashboard application for adverse event monitoring, patient data visualization, and real-time clinical decision support with AI-powered voice integration.

## 🎯 Latest Updates (October 2025)

### Enhanced TODO System with AI Agent Delegation
- ✅ **Hierarchical Task Management**: Multi-level sub-tasks with nested organization
- ✅ **AI Agent Assignment**: Delegate tasks to specific AI agents (Lab Analysis, Documentation, etc.)
- ✅ **Smart Task IDs**: Auto-generated unique identifiers for each task
- ✅ **Advanced Status Tracking**: Support for `pending`, `executing`, and `finished` states
- ✅ **Visual Indicators**: Task IDs, agent badges, and sub-task indentation
- ✅ **New API Endpoint**: `POST /api/enhanced-todo` for creating complex task structures

### Precision Focus System
- ✅ **Sub-Element Focusing**: Target specific elements within dashboard components
- ✅ **Custom Zoom Levels**: Configurable zoom and duration for focus events
- ✅ **Highlight Animations**: Visual pulse effects on focused elements
- ✅ **Voice-Driven Navigation**: API integration for voice commands to focus canvas items
- ✅ **SSE Broadcasting**: Real-time focus events across all connected clients
- ✅ **Enhanced API**: `POST /api/focus` with support for `subElement` and `focusOptions`

### Redis Integration & Deployment
- ✅ **Redis Persistence**: Optional Redis integration for permanent data storage
- ✅ **Multiple Server Options**: File-based, in-memory, and Redis storage backends
- ✅ **Environment Management**: Comprehensive .env configuration
- ✅ **Vercel Ready**: Production deployment configuration included

### EASL Iframe Integration (NEW!)
- ✅ **Bidirectional Communication**: Send queries from canvas to EASL iframe
- ✅ **Dedicated Query UI**: Purple gradient input bar clearly separate from iframe
- ✅ **Multiple Input Methods**: UI button, Enter key, API, voice commands, console
- ✅ **Real-Time Messaging**: postMessage API with SSE broadcasting
- ✅ **Context-Aware Queries**: Include patient data and metadata
- ✅ **Response Storage**: EASL responses stored in Redis/boardItems.json
- ✅ **Conversation History**: Retrieve past conversations via API
- ✅ **Security**: Origin validation and message type checking
- ✅ **API Endpoints**: `POST /api/send-to-easl` (send query), `POST /api/easl-response` (receive response)

### Selected Item Tracking (NEW!)
- ✅ **Active Item Detection**: Track which item has the blue highlight
- ✅ **Automatic Sync**: Frontend automatically syncs selection to backend
- ✅ **REST API**: `GET /api/selected-item` returns currently selected item
- ✅ **Full Item Details**: Returns complete item data including type-specific fields
- ✅ **Context-Aware**: Enable voice commands and smart features based on selection
- ✅ **Browser Access**: `window.getSelectedItem()` for console access

### Agent Zone Placement (NEW!)
- ✅ **Zone Parameter**: Specify target zone for agent results
- ✅ **7 Predefined Zones**: Task, Retrieved Data, Doctor's Notes, Adverse Events, etc.
- ✅ **Auto-Positioning**: Automatic placement within zones with collision detection
- ✅ **Flexible Control**: Zone-based or manual coordinates
- ✅ **Smart Layout**: Multi-column arrangement within zones

## Features

- 🏥 **Patient Context Dashboard**: Comprehensive patient demographics and medical history
- 📊 **Encounter Timeline**: Visual timeline of patient encounters with medication overlays
- ⚠️ **Adverse Event Analytics**: RUCAM scoring and causality assessment
- 🧪 **Lab Visualization**: Interactive lab trends and tables with color-coded status
- 🔍 **Differential Diagnosis**: Track and manage differential diagnoses
- 🎯 **Advanced Focus System**: Sub-element precision focusing with voice integration
- 📋 **Enhanced TODO Lists**: Hierarchical tasks with AI agent delegation
- 🔄 **Real-Time Sync**: Server-Sent Events for instant updates across all clients
- 🎨 **Modern UI**: Clean, responsive design with smooth animations
- 🤝 **Google Meet Integration**: Collaborative viewing in video calls
- 🤖 **AI Voice Integration**: Voice-driven canvas operations via api3.medforce-ai.com
- 💬 **EASL Integration**: Seamless communication with embedded EASL chat interface

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the backend server:
```bash
node api/server.js
```

3. In a new terminal, start the frontend:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view the app

### Testing the API

Run the test script to verify all endpoints:

```bash
node test-dashboard-api.js
```

### Storybook (Optional)

To view and test components in Storybook:

```bash
npm run storybook
```

Open [http://localhost:6006](http://localhost:6006) to view Storybook

## Usage

### Canvas Navigation
- **Pan**: Left-click and drag on empty space, or middle mouse button
- **Zoom**: Mouse wheel up/down (zooms around cursor)
- **Reset View**: Ctrl+R to reset viewport
- **Focus**: Ctrl+F to focus on first item

### Dashboard Components

The application includes 6 specialized dashboard components:

1. **PatientContext** - Patient demographics and medical summary
2. **MedicationTimeline** - Visual timeline of medications and encounters
3. **AdverseEventAnalytics** - RUCAM scoring and AE analysis
4. **LabTable** - Tabular lab values with trends
5. **LabChart** - Visual lab trends over time
6. **DifferentialDiagnosis** - Diagnosis tracking and management

### API Usage

#### Create a Dashboard Component

```javascript
const response = await fetch('http://localhost:3001/api/components', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    componentType: 'PatientContext',
    props: {
      patientData: {
        patient: {
          name: 'Sarah Miller',
          age: 43,
          sex: 'Female',
          mrn: 'MC-001001'
        }
      }
    }
  })
});

const component = await response.json();
console.log('Created:', component.id);
```

#### Focus on a Component

```javascript
await fetch('http://localhost:3001/api/focus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objectId: 'dashboard-item-patient-context'
  })
});
```

See `DASHBOARD_SYSTEM.md` for complete API documentation.

## 🚀 New API Endpoints

### Enhanced TODO Creation

Create complex task structures with AI agent delegation and hierarchical sub-tasks.

**Endpoint:** `POST /api/enhanced-todo`

**Request Body:**
```json
{
  "title": "Patient Care Coordination Tasks",
  "description": "Critical tasks for patient care coordination",
  "todos": [
    {
      "id": "task-001",  // Optional: auto-generated if not provided
      "text": "Review patient's latest lab results",
      "status": "executing",  // pending | executing | finished
      "agent": "Lab Analysis Agent",
      "subTodos": [  // Optional hierarchical sub-tasks
        {
          "text": "Check CBC values",
          "status": "finished"
        },
        {
          "text": "Review liver function tests",
          "status": "executing"
        }
      ]
    }
  ],
  "x": 1000,  // Optional: position
  "y": 100,
  "width": 450,
  "height": "auto"
}
```

**Response:**
```json
{
  "id": "enhanced-todo-1729148234567-abc123",
  "type": "todo",
  "todoData": {
    "title": "Patient Care Coordination Tasks",
    "todos": [...]
  },
  "x": 1000,
  "y": 100,
  "createdAt": "2025-10-17T10:30:34.567Z"
}
```

### Precision Focus System

Navigate to specific canvas elements or sub-elements with custom zoom and highlighting.

**Endpoint:** `POST /api/focus`

**Request Body:**
```json
{
  "itemId": "dashboard-item-1759853783245-patient-context",
  "subElement": "medication-timeline",  // Optional: focus on sub-element
  "focusOptions": {
    "zoom": 1.5,      // Optional: zoom level (default: 1.2)
    "duration": 800,  // Optional: animation duration in ms (default: 600)
    "highlight": true // Optional: show highlight animation (default: true)
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Focus event broadcasted",
  "itemId": "dashboard-item-1759853783245-patient-context",
  "subElement": "medication-timeline"
}
```

### EASL Iframe Communication

Send queries from the canvas to the embedded EASL chat interface.

**Endpoint:** `POST /api/send-to-easl`

**Request Body:**
```json
{
  "query": "Analyze patient's latest lab results",
  "metadata": {
    "patientId": "P001",
    "context": "adverse-event",
    "source": "api"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Query sent to EASL",
  "query": "Analyze patient's latest lab results",
  "metadata": { ... }
}
```

**Browser Usage:**
```javascript
// Send query from browser console
window.sendQueryToEASL("Your query here", { patientId: "P001" });

// Focus on EASL iframe and send query
window.centerOnItem('iframe-item-easl-interface', 1.0, 1200);
setTimeout(() => {
  window.sendQueryToEASL("Your query");
}, 1300);
```

**Documentation:**
- See `IFRAME_COMMUNICATION_GUIDE.md` for complete implementation guide
- See `EASL_INTEGRATION_EXAMPLES.md` for usage examples
- See `QUICK_REFERENCE.md` for quick reference
- Run `node test-easl-integration.js` to test the integration

### Selected Item Tracking

Get the currently selected/active item on the canvas (the one with blue highlight).

**Endpoint:** `GET /api/selected-item`

**Response (Item Selected):**
```json
{
  "selected": true,
  "selectedItemId": "dashboard-item-1759853783245-patient-context",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "selectedItem": {
    "id": "dashboard-item-1759853783245-patient-context",
    "type": "component",
    "title": "Patient Context",
    "x": 100,
    "y": 100,
    "componentType": "PatientContext"
  }
}
```

**Response (No Selection):**
```json
{
  "selected": false,
  "message": "No item currently selected",
  "selectedItem": null
}
```

**Browser Usage:**
```javascript
// Get selected item from console
window.getSelectedItem()

// Or call API
fetch('http://localhost:3001/api/selected-item')
  .then(r => r.json())
  .then(data => {
    if (data.selected) {
      console.log('Selected:', data.selectedItem.type);
    }
  });
```

**Use Cases:**
- Voice commands: "What am I looking at?"
- Context-aware help and suggestions
- Analytics: Track what users are viewing
- Smart integrations based on selected item type

**Documentation:**
- See `SELECTED_ITEM_API.md` for complete API documentation
- Run `node test-selected-item.js` to test the endpoint

## Project Structure

```
src/
├── components/
│   ├── Canvas.tsx          # Main canvas component
│   ├── BoardItem.tsx      # Individual board items
│   ├── Toolbar.tsx         # Top toolbar
│   └── *.stories.tsx       # Storybook stories
├── types.ts               # TypeScript type definitions
├── App.tsx               # Main application component
└── index.tsx             # Application entry point
```

## Technologies Used

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Styled Components** - CSS-in-JS styling
- **Framer Motion** - Animations and transitions
- **React Router** - Routing and navigation

### Backend
- **Express.js** - REST API server
- **Server-Sent Events (SSE)** - Real-time updates
- **Redis** (optional) - Persistent storage
- **CORS** - Cross-origin resource sharing

### Integrations
- **Google Meet Add-ons** - Collaborative viewing
- **Storybook** - Component documentation

## Development

### Available Scripts

- `npm start` - Start frontend development server
- `npm run build` - Build for production
- `npm run storybook` - Start Storybook
- `npm run build-storybook` - Build Storybook
- `npm test` - Run tests
- `node api/server.js` - Start backend server (file-based storage)
- `node test-dashboard-api.js` - Test API endpoints

### Server Options

Three server implementations are available:

1. **server.js** - File-based storage (development)
   - Persists to `src/data/boardItems.json`
   - Best for local development

2. **server-vercel.js** - In-memory storage (Vercel)
   - 1-minute cache
   - Suitable for serverless deployment

3. **server-redis.js** - Redis persistence (production)
   - Permanent storage
   - Requires `REDIS_URL` environment variable

### Environment Variables

Create a `.env` file:

```bash
# Build Configuration
FAST_REFRESH=false
GENERATE_SOURCEMAP=false
SKIP_PREFLIGHT_CHECK=true
CI=false  # Disable CI mode to treat warnings as warnings, not errors

# Backend API URL
REACT_APP_API_BASE_URL=http://localhost:3001
# For production: REACT_APP_API_BASE_URL=https://your-vercel-url.vercel.app

# Redis (optional, for server-redis.js)
REDIS_URL=redis://localhost:6379

# Google Meet (optional)
REACT_APP_GCP_PROJECT_NUMBER=your_project_number
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
