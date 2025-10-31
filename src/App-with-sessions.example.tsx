/**
 * Example: App.tsx with Session Support
 * 
 * This is an example of how to modify your existing App.tsx to support
 * session-based boards. Copy the relevant parts to your actual App.tsx.
 * 
 * Key changes:
 * 1. Add session state management
 * 2. Include sessionId in all API calls
 * 3. Update SSE connection to use sessionId
 * 4. Support session ID from URL params (for sharing)
 */

import React, { useState, useCallback, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useSearchParams } from "react-router-dom";
import styled from "styled-components";
import Canvas from "./components/Canvas";
import MeetSidePanel from "./components/MeetSidePanel";
import MeetMainStage from "./components/MeetMainStage";
import boardItemsData from "./data/boardItems.json";

const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  background-color: #f5f5f5;
  position: relative;
`;

const SessionInfo = styled.div`
  position: fixed;
  top: 10px;
  left: 10px;
  padding: 8px 16px;
  background: #1a73e8;
  color: white;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  z-index: 10000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  font-family: monospace;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  
  &:hover {
    max-width: none;
    white-space: normal;
  }
`;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/meet/Sidepanel" element={<MeetSidePanel />} />
        <Route path="/meet/sidepanel" element={<MeetSidePanel />} />
        <Route path="/meet/Mainstage" element={<MeetMainStage />} />
        <Route path="/meet/mainstage" element={<MeetMainStage />} />
        <Route path="/" element={<BoardApp />} />
      </Routes>
    </Router>
  );
}

// Main board application component with session support
export function BoardApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Get API base URL
  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL ||
    (window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : window.location.origin);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        // Priority 1: Check URL params (for sharing)
        let sid = searchParams.get('sessionId');
        
        // Priority 2: Check localStorage
        if (!sid) {
          sid = localStorage.getItem('boardSessionId');
        }
        
        // Priority 3: Create new session
        if (!sid) {
          console.log('📋 Creating new session...');
          const response = await fetch(`${API_BASE_URL}/api/session`);
          const data = await response.json();
          sid = data.sessionId;
          console.log('✅ New session created:', sid);
        } else {
          console.log('📋 Using existing session:', sid);
        }
        
        // Store in localStorage
        localStorage.setItem('boardSessionId', sid);
        
        // Update URL if not present
        if (!searchParams.get('sessionId')) {
          setSearchParams({ sessionId: sid });
        }
        
        setSessionId(sid);
      } catch (error) {
        console.error('❌ Failed to initialize session:', error);
        // Fallback: generate a simple session ID
        const fallbackId = `session-${Date.now()}`;
        setSessionId(fallbackId);
        localStorage.setItem('boardSessionId', fallbackId);
      }
    };

    initSession();
  }, [API_BASE_URL, searchParams, setSearchParams]);

  // Load items from backend (session-aware)
  useEffect(() => {
    if (!sessionId) return;

    const loadItemsFromBothSources = async () => {
      try {
        setIsLoading(true);

        // Start with static data
        let allItems = [...boardItemsData];
        console.log("📁 Loaded static items:", boardItemsData.length, "items");

        // Try to load from session-aware API
        try {
          const apiUrl = `${API_BASE_URL}/api/board-items?sessionId=${sessionId}`;
          console.log("📡 Fetching from:", apiUrl);
          const response = await fetch(apiUrl);

          if (response.ok) {
            const data = await response.json();
            const apiItems = data.items || [];
            console.log("🌐 Loaded API items:", apiItems.length, "items");

            // Merge API items with static items, avoiding duplicates
            const staticIds = new Set(boardItemsData.map((item) => item.id));
            const uniqueApiItems = apiItems.filter(
              (item) => !staticIds.has(item.id)
            );

            allItems = [...boardItemsData, ...uniqueApiItems];
            console.log("✅ Combined items:", allItems.length, "total items");
          } else {
            console.log("⚠️ API not available, using only static data");
          }
        } catch (apiError) {
          console.log("⚠️ API not available, using only static data:", apiError.message);
        }

        setItems(allItems);
      } catch (error) {
        console.error("❌ Error loading items:", error);
        setItems(boardItemsData);
      } finally {
        setIsLoading(false);
      }
    };

    loadItemsFromBothSources();
  }, [API_BASE_URL, sessionId]);

  // Expose selected item globally and sync with backend
  useEffect(() => {
    if (!sessionId) return;

    (window as any).getSelectedItem = () => {
      if (!selectedItemId) return null;
      const selectedItem = items.find((item) => item.id === selectedItemId);
      return selectedItem || null;
    };

    if (selectedItemId) {
      fetch(`${API_BASE_URL}/api/selected-item?sessionId=${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedItemId, sessionId }),
      }).catch((err) => {
        console.error("Failed to sync selected item:", err);
      });
    }
  }, [selectedItemId, items, API_BASE_URL, sessionId]);

  const updateItem = useCallback(
    (id, updates) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );

      // Sync updates to backend (session-aware)
      if (sessionId && (updates.height !== undefined || updates.noteData !== undefined || updates.content !== undefined)) {
        fetch(`${API_BASE_URL}/api/board-items/${id}?sessionId=${sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...updates, sessionId }),
        }).catch((err) => {
          console.error("Failed to sync update to backend:", err);
        });
      }
    },
    [API_BASE_URL, sessionId]
  );

  const deleteItem = useCallback(
    (id) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
    },
    [selectedItemId]
  );

  const focusOnItem = useCallback((itemId) => {
    setSelectedItemId(itemId);
  }, []);

  const handleFocusRequest = useCallback(
    (request) => {
      console.log("🎯 Focus request received:", request);

      const targetId = request.objectId || request.itemId;
      const item = items.find((i) => i.id === targetId);

      if (item) {
        console.log("✅ Item found, focusing:", item.id, item.type);

        const focusOptions = request.focusOptions || {};
        const zoom = focusOptions.zoom || 0.8;
        const duration = focusOptions.duration || 1200;

        focusOnItem(targetId);

        if (request.subElement) {
          if ((window as any).centerOnSubElement) {
            (window as any).centerOnSubElement(
              targetId,
              request.subElement,
              zoom,
              duration
            );
          }
        } else {
          if ((window as any).centerOnItem) {
            (window as any).centerOnItem(targetId, zoom, duration);
          }
        }
      } else {
        console.error("❌ Item not found:", targetId);
      }
    },
    [items, focusOnItem]
  );

  // Connect to backend SSE (session-aware)
  useEffect(() => {
    if (!sessionId) return;

    let es: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        // Include session ID in SSE connection
        const sseUrl = `${API_BASE_URL}/api/events?sessionId=${sessionId}`;
        console.log("🔌 Connecting to SSE:", sseUrl);
        es = new EventSource(sseUrl);

        es.addEventListener("connected", (event: any) => {
          const data = JSON.parse(event.data);
          console.log("✅ Connected to SSE for session:", data.sessionId);
        });

        es.addEventListener("ping", (event: any) => {
          console.log("💓 SSE heartbeat");
        });

        es.addEventListener("focus", (event: any) => {
          try {
            const data = JSON.parse(event.data);
            console.log("🎯 Focus event received via SSE:", data);
            handleFocusRequest({
              objectId: data.objectId || data.itemId,
              subElement: data.subElement,
              focusOptions: data.focusOptions,
            });
          } catch (err) {
            console.error("❌ Error handling focus event:", err);
          }
        });

        es.addEventListener("new-item", (event: any) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📦 New item event received:", data);
            const newItem = data.item;
            
            if (!newItem) {
              console.warn("⚠️ No item in new-item event");
              return;
            }

            setItems((prev: any[]) => {
              const exists = prev.some((it) => it.id === newItem.id);
              if (exists) {
                console.warn(`⚠️ Item ${newItem.id} already exists, skipping`);
                return prev;
              }
              console.log(`✅ Adding new item ${newItem.id} to state`);
              return [...prev, newItem];
            });

            // Auto-focus on new item
            setTimeout(() => {
              if ((window as any).centerOnItem) {
                console.log("🎯 Auto-focusing on new item:", newItem.id);
                const zoomLevel = newItem.type === "doctor-note" ? 1.0 : 0.8;
                (window as any).centerOnItem(newItem.id, zoomLevel, 1200);
              }
            }, 500);
          } catch (err) {
            console.error("❌ Error handling new-item event:", err);
          }
        });

        es.onerror = (error) => {
          console.error("❌ SSE connection error:", error);
          console.log("🔄 Will attempt to reconnect in 5 seconds...");
          es?.close();
          reconnectTimeout = setTimeout(connect, 5000);
        };

        es.onopen = () => {
          console.log("🌐 SSE connection opened");
        };
      } catch (error) {
        console.error("❌ Error creating SSE connection:", error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (es) {
        console.log("🔌 Closing SSE connection");
        es.close();
      }
    };
  }, [handleFocusRequest, API_BASE_URL, sessionId]);

  if (isLoading || !sessionId) {
    return (
      <AppContainer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          color: "#666",
        }}
      >
        {!sessionId ? "Initializing session..." : "Loading board items..."}
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <SessionInfo title={`Session ID: ${sessionId}\nClick to copy`} onClick={() => {
        navigator.clipboard.writeText(sessionId);
        alert('Session ID copied to clipboard!');
      }}>
        Session: {sessionId.substring(0, 8)}...
      </SessionInfo>
      <Canvas
        items={items}
        selectedItemId={selectedItemId}
        onUpdateItem={updateItem}
        onDeleteItem={deleteItem}
        onSelectItem={setSelectedItemId}
        onFocusRequest={handleFocusRequest}
        onAddItem={() => {}}
        onResetBoard={() => {}}
      />
    </AppContainer>
  );
}

export default App;
