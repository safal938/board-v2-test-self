require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const redis = require("redis");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Redis client setup
let redisClient = null;
let isRedisConnected = false;

const initRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn("⚠️  REDIS_URL not configured, using in-memory storage");
    return false;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 2) {
            console.error("❌ Redis connection failed after 2 retries");
            return new Error("Redis connection failed");
          }
          return Math.min(retries * 500, 2000);
        },
      },
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis Client Error:", err.message);
      isRedisConnected = false;
    });

    redisClient.on("connect", () => {
      console.log("✅ Redis connected");
      isRedisConnected = true;
    });

    await redisClient.connect();
    console.log("✅ Redis client initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error.message);
    console.log("⚠️  Continuing with in-memory storage as fallback");
    isRedisConnected = false;
    redisClient = null;
    return false;
  }
};

// In-memory storage fallback (per session)
const inMemorySessions = new Map();

// SSE clients per session
const sseClientsBySession = new Map();

// Helper function to broadcast SSE messages to a specific session
const broadcastSSE = (sessionId, message) => {
  const clients = sseClientsBySession.get(sessionId) || new Set();
  const eventType = message.event || "new-item";
  const data = { ...message };
  delete data.event;

  for (const client of clients) {
    try {
      client.write(`event: ${eventType}\n`);
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  }
};

// Middleware to extract or create session ID
const sessionMiddleware = (req, res, next) => {
  // Check for session ID in header, query param, or body
  // Support both sessionId (camelCase) and session_id (snake_case) for compatibility
  let sessionId =
    req.headers["x-session-id"] || 
    req.query.sessionId || 
    req.query.session_id ||
    req.body?.sessionId ||
    req.body?.session_id;

  // If no session ID provided, create a new one
  if (!sessionId) {
    sessionId = uuidv4();
    console.log(`🆕 Created new session: ${sessionId}`);
  }

  // Attach to request
  req.sessionId = sessionId;

  // Send session ID in response header
  res.setHeader("X-Session-Id", sessionId);

  next();
};

// Apply session middleware to all API routes
app.use("/api", sessionMiddleware);

// SSE endpoint - session-specific
app.get("/api/events", (req, res) => {
  const sessionId = req.sessionId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Session-Id", sessionId);

  if (res.flushHeaders) res.flushHeaders();

  // Initial event with session info
  res.write("event: connected\n");
  res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);

  // Add client to session-specific set
  if (!sseClientsBySession.has(sessionId)) {
    sseClientsBySession.set(sessionId, new Set());
  }
  sseClientsBySession.get(sessionId).add(res);

  console.log(`📡 SSE client connected to session: ${sessionId}`);

  // Keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\n`);
      res.write(`data: ${Date.now()}\n\n`);
    } catch (_) {}
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const clients = sseClientsBySession.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClientsBySession.delete(sessionId);
        console.log(`🔌 Last client disconnected from session: ${sessionId}`);
      }
    }
    try {
      res.end();
    } catch (_) {}
  });
});

// Load static items from file (initialization template)
const loadStaticItems = async () => {
  try {
    const sourceDataPath = path.join(__dirname, "data", "boardItems.json");
    const sourceData = await fs.readFile(sourceDataPath, "utf8");
    const items = JSON.parse(sourceData);
    console.log(`📁 Loaded ${items.length} items from static file`);
    return items;
  } catch (error) {
    console.error("❌ Error loading static data:", error);
    return [];
  }
};

// Load board items for a specific session
const loadBoardItems = async (sessionId) => {
  const redisKey = `boardItems:${sessionId}`;

  // Try Redis first
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(redisKey);
      if (data) {
        const items = JSON.parse(data);
        console.log(
          `✅ Loaded ${items.length} items from Redis for session ${sessionId}`
        );
        return items;
      }
      console.log(
        `📦 No items in Redis for session ${sessionId}, initializing with static data`
      );
    } catch (error) {
      console.error("❌ Redis read error:", error);
    }
  }

  // Check in-memory storage
  if (inMemorySessions.has(sessionId)) {
    const items = inMemorySessions.get(sessionId);
    console.log(
      `✅ Loaded ${items.length} items from memory for session ${sessionId}`
    );
    return items;
  }

  // Initialize new session with static data
  const staticItems = await loadStaticItems();

  // Save to storage
  await saveBoardItems(sessionId, staticItems);

  return staticItems;
};

// Save board items for a specific session
const saveBoardItems = async (sessionId, items) => {
  const redisKey = `boardItems:${sessionId}`;

  // Try Redis first
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(redisKey, JSON.stringify(items));
      // Set expiration (24 hours) to prevent infinite growth
      await redisClient.expire(redisKey, 86400);
      console.log(
        `✅ Saved ${items.length} items to Redis for session ${sessionId}`
      );
      return true;
    } catch (error) {
      console.error("❌ Redis write error:", error);
    }
  }

  // Fallback to in-memory
  inMemorySessions.set(sessionId, items);
  console.log(
    `✅ Saved ${items.length} items to memory for session ${sessionId}`
  );
  return true;
};

// Zone configurations (same as before)
const TASK_ZONE = { x: 4200, y: 0, width: 2000, height: 2100 };
const RETRIEVED_DATA_ZONE = { x: 4200, y: -4600, width: 2000, height: 2100 };
const DOCTORS_NOTE_ZONE = { x: 4200, y: -2300, width: 2000, height: 2100 };

// Helper functions (positioning logic - same as original)
const estimateItemHeight = (item) => {
  if (
    item.height &&
    item.height !== "auto" &&
    typeof item.height === "number"
  ) {
    return item.height;
  }

  if (item.type === "todo" && item.todoData) {
    const baseHeight = 120;
    const mainTodoHeight = 50;
    const subTodoHeight = 30;
    const descriptionHeight = item.todoData.description ? 30 : 0;

    let totalHeight = baseHeight + descriptionHeight;

    if (item.todoData.todos && Array.isArray(item.todoData.todos)) {
      item.todoData.todos.forEach((todo) => {
        totalHeight += mainTodoHeight;
        if (todo.subTodos && Array.isArray(todo.subTodos)) {
          totalHeight += todo.subTodos.length * subTodoHeight;
        }
      });
    }

    return Math.min(Math.max(totalHeight, 200), 1200);
  }

  if (item.type === "agent" && item.agentData) {
    const baseHeight = 100;
    const contentLength = item.agentData.markdown?.length || 0;
    const estimatedLines = Math.ceil(contentLength / 60);
    return Math.min(Math.max(baseHeight + estimatedLines * 20, 200), 800);
  }

  if (item.type === "lab-result") {
    return 280;
  }

  return 450;
};

// Collision detection function
const checkCollision = (item1, item2) => {
  if (item1.height === "auto" || item2.height === "auto") {
    return false;
  }

  const h1 = typeof item1.height === "number" ? item1.height : 500;
  const h2 = typeof item2.height === "number" ? item2.height : 500;

  const noCollision =
    item1.x + item1.width <= item2.x ||
    item2.x + item2.width <= item1.x ||
    item1.y + h1 <= item2.y ||
    item2.y + h2 <= item1.y;

  return !noCollision;
};

// Find position within Task Management Zone (ONLY for TODO items)
const findTaskZonePosition = (newItem, existingItems) => {
  const padding = 60;
  const colWidth = 520;
  const startX = TASK_ZONE.x + 60;
  const startY = TASK_ZONE.y + 60;
  const maxColumns = 3;

  // Filter existing items to only those in the Task Management Zone AND are TODOs
  const taskZoneItems = existingItems.filter(
    (item) =>
      item.x >= TASK_ZONE.x &&
      item.x < TASK_ZONE.x + TASK_ZONE.width &&
      item.y >= TASK_ZONE.y &&
      item.y < TASK_ZONE.y + TASK_ZONE.height &&
      item.type === "todo" // ONLY TODO items belong in Task Zone
  );

  console.log(
    `🎯 Finding position in Task Management Zone for ${newItem.type} item`
  );
  console.log(
    `📊 Found ${taskZoneItems.length} existing TODO items in Task Zone`
  );

  const newItemHeight = estimateItemHeight(newItem);
  const newItemWidth = newItem.width || colWidth;

  console.log(
    `📏 Estimated new item dimensions: ${newItemWidth}w × ${newItemHeight}h`
  );

  const columns = Array(maxColumns).fill(startY);

  taskZoneItems.forEach((item) => {
    const col = Math.floor((item.x - startX) / (colWidth + padding));
    if (col >= 0 && col < maxColumns) {
      const itemHeight = estimateItemHeight(item);
      const itemBottom = item.y + itemHeight + padding;

      if (itemBottom > columns[col]) {
        columns[col] = itemBottom;
      }

      console.log(
        `📦 Item ${item.id} in column ${col}, bottom at ${itemBottom}px (height: ${itemHeight}px)`
      );
    }
  });

  console.log(
    `📊 Column heights: ${columns.map((h, i) => `Col${i}:${h}`).join(", ")}`
  );

  let bestCol = 0;
  let bestY = columns[0];

  for (let col = 0; col < maxColumns; col++) {
    if (columns[col] < bestY) {
      bestY = columns[col];
      bestCol = col;
    }
  }

  const x = startX + bestCol * (colWidth + padding);
  const y = bestY;

  if (y + newItemHeight > TASK_ZONE.y + TASK_ZONE.height) {
    console.log(`⚠️  Item would exceed zone height, trying other columns`);
    for (let col = 0; col < maxColumns; col++) {
      if (columns[col] + newItemHeight <= TASK_ZONE.y + TASK_ZONE.height) {
        const altX = startX + col * (colWidth + padding);
        const altY = columns[col];
        console.log(`✅ Found space in column ${col} at (${altX}, ${altY})`);
        return { x: altX, y: altY };
      }
    }
  }

  console.log(`✅ Placing item in column ${bestCol} at (${x}, ${y})`);
  return { x, y };
};

// Generic function to find position in any zone
const findPositionInZone = (newItem, existingItems, zoneConfig) => {
  const padding = 60;
  const colWidth = 520;
  const startX = zoneConfig.x + 60;
  const startY = zoneConfig.y + 60;
  const maxColumns = Math.floor(
    (zoneConfig.width - 120) / (colWidth + padding)
  );

  const zoneItems = existingItems.filter(
    (item) =>
      item.x >= zoneConfig.x &&
      item.x < zoneConfig.x + zoneConfig.width &&
      item.y >= zoneConfig.y &&
      item.y < zoneConfig.y + zoneConfig.height
  );

  console.log(
    `🎯 Finding position in zone (${zoneConfig.x}, ${zoneConfig.y}) for ${newItem.type} item`
  );
  console.log(`📊 Found ${zoneItems.length} existing items in zone`);

  const newItemHeight = estimateItemHeight(newItem);
  const newItemWidth = newItem.width || colWidth;

  console.log(
    `📏 Estimated new item dimensions: ${newItemWidth}w × ${newItemHeight}h`
  );

  const columns = Array(maxColumns).fill(startY);

  zoneItems.forEach((item) => {
    const col = Math.floor((item.x - startX) / (colWidth + padding));
    if (col >= 0 && col < maxColumns) {
      const itemHeight = estimateItemHeight(item);
      const itemBottom = item.y + itemHeight + padding;

      if (itemBottom > columns[col]) {
        columns[col] = itemBottom;
      }

      console.log(
        `📦 Item ${item.id} in column ${col}, bottom at ${itemBottom}px (height: ${itemHeight}px)`
      );
    }
  });

  console.log(
    `📊 Column heights: ${columns.map((h, i) => `Col${i}:${h}`).join(", ")}`
  );

  let bestCol = 0;
  let bestY = columns[0];

  for (let col = 0; col < maxColumns; col++) {
    if (columns[col] < bestY) {
      bestY = columns[col];
      bestCol = col;
    }
  }

  const x = startX + bestCol * (colWidth + padding);
  const y = bestY;

  if (y + newItemHeight > zoneConfig.y + zoneConfig.height) {
    console.log(`⚠️  Item would exceed zone height, trying other columns`);
    for (let col = 0; col < maxColumns; col++) {
      if (columns[col] + newItemHeight <= zoneConfig.y + zoneConfig.height) {
        const altX = startX + col * (colWidth + padding);
        const altY = columns[col];
        console.log(`✅ Found space in column ${col} at (${altX}, ${altY})`);
        return { x: altX, y: altY };
      }
    }
    console.log(`⚠️  No space found, placing at top of zone`);
    return { x: startX, y: startY };
  }

  console.log(`✅ Placing item in column ${bestCol} at (${x}, ${y})`);
  return { x, y };
};

// Find position within Doctor's Notes Zone
const findDoctorsNotePosition = (newItem, existingItems) => {
  const padding = 50;
  const rowHeight = 620;
  const colWidth = 470;

  const noteZoneItems = existingItems.filter(
    (item) =>
      item.x >= DOCTORS_NOTE_ZONE.x &&
      item.x < DOCTORS_NOTE_ZONE.x + DOCTORS_NOTE_ZONE.width &&
      item.y >= DOCTORS_NOTE_ZONE.y &&
      item.y < DOCTORS_NOTE_ZONE.y + DOCTORS_NOTE_ZONE.height &&
      item.type === "doctor-note"
  );

  console.log(
    `🎯 Finding position in Doctor's Notes Zone for ${newItem.type} item`
  );
  console.log(
    `📊 Found ${noteZoneItems.length} existing notes in Doctor's Notes Zone`
  );

  const maxCols = Math.floor(DOCTORS_NOTE_ZONE.width / colWidth);
  const maxRows = Math.floor(DOCTORS_NOTE_ZONE.height / rowHeight);

  console.log(
    `📐 Grid capacity: ${maxCols} columns × ${maxRows} rows = ${
      maxCols * maxRows
    } positions`
  );

  const grid = Array(maxRows)
    .fill(null)
    .map(() => Array(maxCols).fill(false));

  noteZoneItems.forEach((item) => {
    const col = Math.floor((item.x - DOCTORS_NOTE_ZONE.x - padding) / colWidth);
    const row = Math.floor(
      (item.y - DOCTORS_NOTE_ZONE.y - padding) / rowHeight
    );

    if (row >= 0 && row < maxRows && col >= 0 && col < maxCols) {
      grid[row][col] = true;
      console.log(`🔒 Position occupied: row ${row}, col ${col} by ${item.id}`);
    }
  });

  for (let row = 0; row < maxRows; row++) {
    for (let col = 0; col < maxCols; col++) {
      if (!grid[row][col]) {
        const x = DOCTORS_NOTE_ZONE.x + col * colWidth + padding;
        const y = DOCTORS_NOTE_ZONE.y + row * rowHeight + padding;
        console.log(
          `✅ Found available position: row ${row}, col ${col} at (${x}, ${y})`
        );
        return { x, y };
      }
    }
  }

  const x = DOCTORS_NOTE_ZONE.x + padding;
  const y = DOCTORS_NOTE_ZONE.y + padding + noteZoneItems.length * rowHeight;
  console.log(`⚠️  Grid full, stacking vertically at (${x}, ${y})`);
  return { x, y };
};

// Find position within Retrieved Data Zone
const findRetrievedDataZonePosition = (newItem, existingItems) => {
  const padding = 60;
  const rowHeight = 490;
  const colWidth = 560;

  const retrievedDataZoneItems = existingItems.filter(
    (item) =>
      item.x >= RETRIEVED_DATA_ZONE.x &&
      item.x < RETRIEVED_DATA_ZONE.x + RETRIEVED_DATA_ZONE.width &&
      item.y >= RETRIEVED_DATA_ZONE.y &&
      item.y < RETRIEVED_DATA_ZONE.y + RETRIEVED_DATA_ZONE.height &&
      (item.type === "ehr-data" ||
        item.type === "lab-result" ||
        item.type === "patient-data" ||
        item.type === "clinical-data")
  );

  console.log(
    `🎯 Finding position in Retrieved Data Zone for ${newItem.type} item`
  );
  console.log(
    `📊 Found ${retrievedDataZoneItems.length} existing EHR data items in Retrieved Data Zone`
  );

  const maxCols = Math.floor(RETRIEVED_DATA_ZONE.width / colWidth);
  const maxRows = Math.floor(RETRIEVED_DATA_ZONE.height / rowHeight);

  console.log(
    `📐 Grid capacity: ${maxCols} columns × ${maxRows} rows = ${
      maxCols * maxRows
    } positions`
  );

  const grid = Array(maxRows)
    .fill(null)
    .map(() => Array(maxCols).fill(false));

  retrievedDataZoneItems.forEach((item) => {
    const col = Math.floor((item.x - RETRIEVED_DATA_ZONE.x) / colWidth);
    const row = Math.floor((item.y - RETRIEVED_DATA_ZONE.y - 60) / rowHeight);

    if (row >= 0 && row < maxRows && col >= 0 && col < maxCols) {
      grid[row][col] = true;
      console.log(`🔒 Position occupied: row ${row}, col ${col} by ${item.id}`);
    }
  });

  for (let row = 0; row < maxRows; row++) {
    for (let col = 0; col < maxCols; col++) {
      if (!grid[row][col]) {
        const x = RETRIEVED_DATA_ZONE.x + col * colWidth + padding;
        const y = RETRIEVED_DATA_ZONE.y + row * rowHeight + 60;
        console.log(
          `✅ Found available position: row ${row}, col ${col} at (${x}, ${y})`
        );
        return { x, y };
      }
    }
  }

  const x = RETRIEVED_DATA_ZONE.x + padding;
  const y =
    RETRIEVED_DATA_ZONE.y +
    60 +
    retrievedDataZoneItems.length * (rowHeight + padding);
  console.log(`⚠️  Grid full, stacking vertically at (${x}, ${y})`);
  return { x, y };
};

// Legacy collision detection for non-API items
const findNonOverlappingPosition = (newItem, existingItems) => {
  const padding = 20;
  const maxAttempts = 50;
  let attempts = 0;

  let testX = newItem.x;
  let testY = newItem.y;

  if (!newItem.x || !newItem.y) {
    testX = Math.random() * 8000 + 100;
    testY = Math.random() * 7000 + 100;
  }

  console.log(
    `🔍 Checking collision for new item at (${testX}, ${testY}) with ${existingItems.length} existing items`
  );

  while (attempts < maxAttempts) {
    let hasCollision = false;

    for (const existingItem of existingItems) {
      const testItem = {
        x: testX,
        y: testY,
        width: newItem.width,
        height: newItem.height,
      };

      if (checkCollision(testItem, existingItem)) {
        console.log(
          `⚠️  Collision detected with existing item ${existingItem.id} at (${existingItem.x}, ${existingItem.y})`
        );
        hasCollision = true;
        break;
      }
    }

    if (!hasCollision) {
      console.log(`✅ No collision found, using position (${testX}, ${testY})`);
      return { x: testX, y: testY };
    }

    let maxBottom = 0;
    for (const existingItem of existingItems) {
      const bottom = existingItem.y + existingItem.height;
      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
    }

    testY = maxBottom + padding;
    console.log(
      `📍 Moving to position below bottom-most item: (${testX}, ${testY})`
    );

    if (testY > 8000) {
      testX = Math.random() * 8000 + 100;
      testY = Math.random() * 7000 + 100;
      console.log(
        `🔄 Canvas too crowded, trying new random position: (${testX}, ${testY})`
      );
    }

    attempts++;
  }

  console.log(
    `⚠️  Could not find non-overlapping position after ${attempts} attempts, using fallback position (${testX}, ${testY})`
  );
  return { x: testX, y: testY };
};

// GET /api/board-items - Get all board items for session
app.get("/api/board-items", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const items = await loadBoardItems(sessionId);

    res.json({
      sessionId,
      items,
      count: items.length,
    });
  } catch (error) {
    console.error("Error loading board items:", error);
    res.status(500).json({ error: "Failed to load board items" });
  }
});

// POST /api/todos - Create a new TODO board item (session-aware)
app.post("/api/todos", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const { title, description, todo_items } = req.body || {};

    if (!title || !Array.isArray(todo_items)) {
      return res.status(400).json({
        error: "title (string) and todo_items (array) are required",
      });
    }

    const normalizeStatus = (s) =>
      ["todo", "in_progress", "done"].includes((s || "").toLowerCase())
        ? s.toLowerCase()
        : "todo";

    const todos = todo_items.map((t) => {
      if (typeof t === "string") return { text: t, status: "todo" };
      if (t && typeof t.text === "string")
        return { text: t.text, status: normalizeStatus(t.status) };
      return { text: String(t), status: "todo" };
    });

    const calculateTodoHeight = (todos, description) => {
      const baseHeight = 80;
      const itemHeight = 35;
      const descriptionHeight = description ? 20 : 0;
      const padding = 20;
      const totalItems = todos.length;
      const contentHeight =
        baseHeight + totalItems * itemHeight + descriptionHeight + padding;
      return Math.min(Math.max(contentHeight, 200), 600);
    };

    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const dynamicHeight = calculateTodoHeight(todos, description);

    // Load existing items for THIS session
    const existingItems = await loadBoardItems(sessionId);

    let itemX, itemY;
    if (req.body.x !== undefined && req.body.y !== undefined) {
      itemX = req.body.x;
      itemY = req.body.y;
    } else {
      const tempItem = { type: "todo", width: 420, height: dynamicHeight };
      const taskPosition = findPositionInZone(
        tempItem,
        existingItems,
        TASK_ZONE
      );
      itemX = taskPosition.x;
      itemY = taskPosition.y;
    }

    const newItem = {
      id,
      type: "todo",
      x: itemX,
      y: itemY,
      width: 420,
      height: dynamicHeight,
      content: "Todo List",
      color: "#ffffff",
      rotation: 0,
      todoData: { title, description: description || "", todos },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const items = [...existingItems, newItem];
    await saveBoardItems(sessionId, items);

    // Broadcast to THIS session only
    broadcastSSE(sessionId, {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    });

    res.status(201).json({ sessionId, item: newItem });
  } catch (error) {
    console.error("Error creating todo item:", error);
    res.status(500).json({ error: "Failed to create todo item" });
  }
});

// POST /api/agents - Create agent item (session-aware)
app.post("/api/agents", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const { title, content, zone } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        error: "title (string) and content (string) are required",
      });
    }

    const zoneConfig = {
      "task-management-zone": TASK_ZONE,
      "retrieved-data-zone": RETRIEVED_DATA_ZONE,
      "doctors-note-zone": DOCTORS_NOTE_ZONE,
    };

    const calculateHeight = (content) => {
      const baseHeight = 80;
      const lineHeight = 20;
      const maxWidth = 520;
      const estimatedLines = Math.ceil(content.length / (maxWidth / 12));
      const contentHeight = Math.max(estimatedLines * lineHeight, 100);
      return Math.min(baseHeight + contentHeight, 800);
    };

    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const dynamicHeight = calculateHeight(content);

    const existingItems = await loadBoardItems(sessionId);

    let itemX, itemY;
    if (req.body.x !== undefined && req.body.y !== undefined) {
      itemX = req.body.x;
      itemY = req.body.y;
    } else if (zone && zoneConfig[zone]) {
      const tempItem = { type: "agent", width: 520, height: dynamicHeight };
      const zonePosition = findPositionInZone(
        tempItem,
        existingItems,
        zoneConfig[zone]
      );
      itemX = zonePosition.x;
      itemY = zonePosition.y;
    } else {
      const tempItem = { type: "agent", width: 520, height: dynamicHeight };
      const taskPosition = findPositionInZone(
        tempItem,
        existingItems,
        TASK_ZONE
      );
      itemX = taskPosition.x;
      itemY = taskPosition.y;
    }

    const newItem = {
      id,
      type: "agent",
      x: itemX,
      y: itemY,
      width: 520,
      height: dynamicHeight,
      content: content,
      color: "#ffffff",
      rotation: 0,
      agentData: { title, markdown: content },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const items = [...existingItems, newItem];
    await saveBoardItems(sessionId, items);

    broadcastSSE(sessionId, {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    });

    res.status(201).json({ sessionId, item: newItem });
  } catch (error) {
    console.error("Error creating agent item:", error);
    res.status(500).json({ error: "Failed to create agent item" });
  }
});

// POST /api/focus - Focus on item (session-aware)
app.post("/api/focus", (req, res) => {
  const sessionId = req.sessionId;
  const { objectId, itemId, subElement, focusOptions } = req.body;

  const targetId = itemId || objectId;

  if (!targetId) {
    return res.status(400).json({
      error: "objectId or itemId is required",
    });
  }

  const defaultOptions = {
    zoom: subElement ? 1.5 : 1.2,
    highlight: !!subElement,
    duration: subElement ? 1500 : 1200,
    scrollIntoView: true,
  };

  const options = { ...defaultOptions, ...(focusOptions || {}) };

  console.log(
    `🎯 Focus request for session ${sessionId}: ${targetId}${
      subElement ? `#${subElement}` : ""
    }`
  );

  broadcastSSE(sessionId, {
    event: "focus",
    objectId: targetId,
    itemId: targetId,
    subElement: subElement || null,
    focusOptions: options,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    sessionId,
    message: `Focus event broadcasted to session`,
    itemId: targetId,
    subElement: subElement || null,
    focusOptions: options,
  });
});

// GET /api/session - Get current session info
app.get("/api/session", async (req, res) => {
  const sessionId = req.sessionId;
  const items = await loadBoardItems(sessionId);

  res.json({
    sessionId,
    itemCount: items.length,
    createdAt: new Date().toISOString(),
    connectedClients: (sseClientsBySession.get(sessionId) || new Set()).size,
  });
});

// DELETE /api/session - Clear session data
app.delete("/api/session", async (req, res) => {
  const sessionId = req.sessionId;

  // Clear from Redis
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(`boardItems:${sessionId}`);
    } catch (error) {
      console.error("Error deleting from Redis:", error);
    }
  }

  // Clear from memory
  inMemorySessions.delete(sessionId);

  // Disconnect SSE clients
  const clients = sseClientsBySession.get(sessionId);
  if (clients) {
    for (const client of clients) {
      try {
        client.end();
      } catch (_) {}
    }
    sseClientsBySession.delete(sessionId);
  }

  res.json({
    success: true,
    message: `Session ${sessionId} cleared`,
    sessionId,
  });
});

// POST /api/lab-results - Create a new lab result board item (session-aware)
app.post("/api/lab-results", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const { parameter, value, unit, status, range, trend } = req.body || {};

    if (!parameter || !value || !unit || !status || !range) {
      return res.status(400).json({
        error: "parameter, value, unit, status, and range are required",
      });
    }

    const validStatuses = ["optimal", "warning", "critical"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "status must be one of: optimal, warning, critical",
      });
    }

    if (!range.min || !range.max || range.min >= range.max) {
      return res.status(400).json({
        error: "range must have valid min and max values where min < max",
      });
    }

    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const existingItems = await loadBoardItems(sessionId);

    let itemX, itemY;
    if (req.body.x !== undefined && req.body.y !== undefined) {
      itemX = req.body.x;
      itemY = req.body.y;
    } else {
      const tempItem = { type: "lab-result", width: 400, height: 280 };
      const position = findPositionInZone(
        tempItem,
        existingItems,
        RETRIEVED_DATA_ZONE
      );
      itemX = position.x;
      itemY = position.y;
    }

    const newItem = {
      id,
      type: "lab-result",
      x: itemX,
      y: itemY,
      width: 400,
      height: 280,
      content: parameter,
      color: "#ffffff",
      rotation: 0,
      labResultData: {
        parameter,
        value,
        unit,
        status,
        range,
        trend: trend || "stable",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const items = [...existingItems, newItem];
    await saveBoardItems(sessionId, items);

    broadcastSSE(sessionId, {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    });

    res.status(201).json({ sessionId, item: newItem });
  } catch (error) {
    console.error("Error creating lab result:", error);
    res.status(500).json({ error: "Failed to create lab result" });
  }
});

// POST /api/ehr-data - Create a new EHR data item (session-aware)
app.post("/api/ehr-data", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const { title, content, dataType, source, x, y, width, height } =
      req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        error: "Title and content are required for EHR data items",
      });
    }

    const existingItems = await loadBoardItems(sessionId);
    const itemId = `item-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    let itemX, itemY;
    if (x !== undefined && y !== undefined) {
      itemX = x;
      itemY = y;
    } else {
      const tempItem = {
        type: "ehr-data",
        width: width || 400,
        height: height || 300,
      };
      const position = findPositionInZone(
        tempItem,
        existingItems,
        RETRIEVED_DATA_ZONE
      );
      itemX = position.x;
      itemY = position.y;
    }

    const newItem = {
      id: itemId,
      type: "ehr-data",
      title: title,
      content: content,
      dataType: dataType || "clinical",
      source: source || "EHR System",
      x: itemX,
      y: itemY,
      width: width || 400,
      height: height || 300,
      timestamp: new Date().toISOString(),
    };

    existingItems.push(newItem);
    await saveBoardItems(sessionId, existingItems);

    console.log(
      `✅ Created EHR data item: ${itemId} - "${title}" in session ${sessionId}`
    );

    broadcastSSE(sessionId, {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    });

    res.status(201).json({ sessionId, item: newItem });
  } catch (error) {
    console.error("Error creating EHR data item:", error);
    res.status(500).json({ error: "Failed to create EHR data item" });
  }
});

// POST /api/doctor-notes - Create a new doctor's note (session-aware)
app.post("/api/doctor-notes", async (req, res) => {
  console.log("📝 POST /api/doctor-notes - Creating doctor's note");

  try {
    const sessionId = req.sessionId;
    const { content, x, y, width, height } = req.body || {};

    const noteId = `doctor-note-${Date.now()}`;
    const noteX = x !== undefined ? x : 4300;
    const noteY = y !== undefined ? y : -2200;
    const noteWidth = width || 450;
    const noteHeight = height || 600;

    const noteItem = {
      id: noteId,
      type: "doctor-note",
      x: noteX,
      y: noteY,
      width: noteWidth,
      height: noteHeight,
      noteData: {
        content: content || "",
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const items = await loadBoardItems(sessionId);
    const position = findPositionInZone(noteItem, items, DOCTORS_NOTE_ZONE);
    noteItem.x = position.x;
    noteItem.y = position.y;

    items.push(noteItem);
    await saveBoardItems(sessionId, items);

    console.log(
      `✅ Created doctor's note: ${noteId} at (${position.x}, ${position.y}) in session ${sessionId}`
    );

    broadcastSSE(sessionId, {
      event: "new-item",
      item: noteItem,
      timestamp: new Date().toISOString(),
      action: "created",
    });

    res.status(201).json({
      success: true,
      sessionId,
      message: "Doctor's note created successfully",
      item: noteItem,
    });
  } catch (error) {
    console.error("❌ Error creating doctor's note:", error);
    res.status(500).json({
      error: "Failed to create doctor's note",
      message: error.message,
    });
  }
});

// POST /api/enhanced-todo - Create enhanced todo with agent delegation (session-aware)
app.post("/api/enhanced-todo", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const {
      title,
      description,
      todos,
      x,
      y,
      width = 450,
      height = "auto",
      color = "#ffffff",
    } = req.body;

    if (!title || !todos || !Array.isArray(todos)) {
      return res.status(400).json({
        error: "title and todos array are required",
      });
    }

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];

      if (!todo.text || !todo.status || !todo.agent) {
        return res.status(400).json({
          error: "Each main todo item must have text, status, and agent fields",
        });
      }
      if (!["pending", "executing", "finished"].includes(todo.status)) {
        return res.status(400).json({
          error: "Todo status must be one of: pending, executing, finished",
        });
      }

      if (!todo.id) {
        const taskId = `task-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 6)}-${i}`;
        todo.id = taskId;
      }

      todos[i] = todo;

      if (todo.subTodos && Array.isArray(todo.subTodos)) {
        for (const subTodo of todo.subTodos) {
          if (!subTodo.text || !subTodo.status) {
            return res.status(400).json({
              error: "Each sub-todo item must have text and status fields",
            });
          }
          if (!["pending", "executing", "finished"].includes(subTodo.status)) {
            return res.status(400).json({
              error:
                "Sub-todo status must be one of: pending, executing, finished",
            });
          }
        }
      }
    }

    const id = `enhanced-todo-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const existingItems = await loadBoardItems(sessionId);

    let itemX, itemY;
    if (x !== undefined && y !== undefined) {
      itemX = x;
      itemY = y;
    } else {
      const tempItem = {
        type: "todo",
        width: width,
        height: height,
        todoData: { todos, description },
      };
      const taskPosition = findPositionInZone(
        tempItem,
        existingItems,
        TASK_ZONE
      );
      itemX = taskPosition.x;
      itemY = taskPosition.y;
    }

    const newItem = {
      id,
      type: "todo",
      x: itemX,
      y: itemY,
      width,
      height,
      color,
      description: description || title,
      todoData: {
        title,
        description: description || "",
        todos,
      },
      rotation: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedItems = [...existingItems, newItem];
    await saveBoardItems(sessionId, updatedItems);

    broadcastSSE(sessionId, {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    });

    res.status(201).json({ sessionId, item: newItem });
  } catch (error) {
    console.error("Error creating enhanced todo:", error);
    res.status(500).json({
      error: "Failed to create enhanced todo",
      message: error.message,
    });
  }
});

// POST /api/board-items - Create a new board item (session-aware)
app.post("/api/board-items", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const {
      type,
      componentType,
      x,
      y,
      width,
      height,
      content,
      color,
      rotation,
      ehrData,
    } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Type is required" });
    }

    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let defaultWidth, defaultHeight, defaultColor, defaultContent;

    if (type === "component") {
      switch (componentType) {
        case "PatientContext":
          defaultWidth = 1600;
          defaultHeight = 300;
          break;
        case "MedicationTimeline":
          defaultWidth = 1600;
          defaultHeight = 400;
          break;
        case "AdverseEventAnalytics":
          defaultWidth = 1600;
          defaultHeight = 500;
          break;
        case "LabTable":
        case "LabChart":
        case "DifferentialDiagnosis":
          defaultWidth = 520;
          defaultHeight = 400;
          break;
        default:
          defaultWidth = 600;
          defaultHeight = 400;
      }
      defaultColor = "#ffffff";
      defaultContent = content || {};
    } else {
      defaultWidth = type === "text" ? 200 : type === "ehr" ? 550 : 150;
      defaultHeight = type === "text" ? 100 : type === "ehr" ? 450 : 150;
      defaultColor =
        type === "sticky" ? "#ffeb3b" : type === "ehr" ? "#e8f5e8" : "#2196f3";
      defaultContent =
        type === "text"
          ? "Double click to edit"
          : type === "ehr"
          ? "EHR Data"
          : "";
    }

    const newItem = {
      id,
      type,
      componentType: componentType || undefined,
      x: x || Math.random() * 8000 + 100,
      y: y || Math.random() * 7000 + 100,
      width: width || defaultWidth,
      height: height || defaultHeight,
      content: content || defaultContent,
      color: color || defaultColor,
      rotation: rotation || 0,
      ehrData: type === "ehr" ? ehrData || {} : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingItems = await loadBoardItems(sessionId);
    const updatedItems = [...existingItems, newItem];
    await saveBoardItems(sessionId, updatedItems);

    broadcastSSE(sessionId, {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    });

    res.status(201).json({ sessionId, item: newItem });
  } catch (error) {
    console.error("Error creating board item:", error);
    res.status(500).json({ error: "Failed to create board item" });
  }
});

// PUT /api/board-items/:id - Update a board item (session-aware)
app.put("/api/board-items/:id", async (req, res) => {
  try {
    const sessionId = req.sessionId;
    const { id } = req.params;
    const updates = req.body;

    const items = await loadBoardItems(sessionId);
    const itemIndex = items.findIndex((item) => item.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Board item not found" });
    }

    items[itemIndex] = {
      ...items[itemIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await saveBoardItems(sessionId, items);

    res.json({ sessionId, item: items[itemIndex] });
  } catch (error) {
    console.error("Error updating board item:", error);
    res.status(500).json({ error: "Failed to update board item" });
  }
});

// Simple in-memory lock for preventing race conditions during deletions
const sessionLocks = new Map();

// Helper function to acquire lock
const acquireLock = async (sessionId) => {
  while (sessionLocks.get(sessionId)) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  sessionLocks.set(sessionId, true);
};

// Helper function to release lock
const releaseLock = (sessionId) => {
  sessionLocks.delete(sessionId);
};

// DELETE /api/board-items/:id - Delete a board item (session-aware with lock)
app.delete("/api/board-items/:id", async (req, res) => {
  const sessionId = req.sessionId;
  const { id } = req.params;

  try {
    // Acquire lock to prevent race conditions
    await acquireLock(sessionId);

    const items = await loadBoardItems(sessionId);
    const filteredItems = items.filter((item) => item.id !== id);

    if (filteredItems.length === items.length) {
      releaseLock(sessionId);
      return res.status(404).json({ error: "Board item not found" });
    }

    await saveBoardItems(sessionId, filteredItems);

    console.log(
      `✅ Deleted item ${id} from session ${sessionId}. ${items.length} → ${filteredItems.length} items`
    );

    // Release lock
    releaseLock(sessionId);

    res.json({ sessionId, message: "Board item deleted successfully" });
  } catch (error) {
    console.error("Error deleting board item:", error);
    releaseLock(sessionId); // Make sure to release lock on error
    res.status(500).json({ error: "Failed to delete board item" });
  }
});

// POST /api/board-items/batch-delete - Delete multiple items at once (session-aware)
app.post("/api/board-items/batch-delete", async (req, res) => {
  const sessionId = req.sessionId;
  const { itemIds } = req.body;

  if (!itemIds || !Array.isArray(itemIds)) {
    return res.status(400).json({ error: "itemIds array is required" });
  }

  try {
    // Acquire lock to prevent race conditions
    await acquireLock(sessionId);

    const items = await loadBoardItems(sessionId);
    const itemIdsSet = new Set(itemIds);
    const filteredItems = items.filter((item) => !itemIdsSet.has(item.id));

    const deletedCount = items.length - filteredItems.length;

    await saveBoardItems(sessionId, filteredItems);

    console.log(
      `✅ Batch deleted ${deletedCount} items from session ${sessionId}. ${items.length} → ${filteredItems.length} items`
    );

    // Release lock
    releaseLock(sessionId);

    res.json({
      sessionId,
      message: `Successfully deleted ${deletedCount} items`,
      deletedCount,
      remainingCount: filteredItems.length,
    });
  } catch (error) {
    console.error("Error batch deleting items:", error);
    releaseLock(sessionId);
    res.status(500).json({ error: "Failed to batch delete items" });
  }
});

// POST /api/board-items/sync - Sync all items to Redis (session-aware)
app.post("/api/board-items/sync", async (req, res) => {
  const sessionId = req.sessionId;
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "items array is required" });
  }

  try {
    // Acquire lock to prevent race conditions
    await acquireLock(sessionId);

    // Save all items to Redis
    await saveBoardItems(sessionId, items);

    console.log(
      `💾 Synced ${items.length} items to Redis for session ${sessionId}`
    );

    // Release lock
    releaseLock(sessionId);

    res.json({
      success: true,
      sessionId,
      itemCount: items.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error syncing items:", error);
    releaseLock(sessionId);
    res.status(500).json({ error: "Failed to sync items" });
  }
});

// POST /api/selected-item - Update currently selected item (session-aware)
app.post("/api/selected-item", async (req, res) => {
  const sessionId = req.sessionId;
  const { selectedItemId } = req.body;

  try {
    // Note: This is per-session, but we're not persisting it
    // Each client tracks their own selection
    res.json({
      success: true,
      sessionId,
      selectedItemId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating selected item:", error);
    res.status(500).json({ error: "Failed to update selected item" });
  }
});

// GET /api/selected-item - Get currently selected item (session-aware)
app.get("/api/selected-item", async (req, res) => {
  const sessionId = req.sessionId;

  try {
    // This endpoint is less useful in session-based architecture
    // since selection is per-client, not per-session
    res.json({
      sessionId,
      selected: false,
      message: "Selection is tracked per-client in session-based mode",
      selectedItem: null,
    });
  } catch (error) {
    console.error("Error getting selected item:", error);
    res.status(500).json({ error: "Failed to get selected item" });
  }
});

// Root API endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Canvas Board API (Session-Based)",
    version: "2.0.0",
    status: "running",
    sessionId: req.sessionId,
    timestamp: new Date().toISOString(),
    endpoints: {
      session: "GET /api/session",
      boardItems: "GET /api/board-items",
      createBoardItem: "POST /api/board-items",
      updateBoardItem: "PUT /api/board-items/:id",
      deleteBoardItem: "DELETE /api/board-items/:id",
      events: "GET /api/events (SSE)",
      createTodo: "POST /api/todos",
      createEnhancedTodo: "POST /api/enhanced-todo",
      createAgent: "POST /api/agents",
      createLabResult: "POST /api/lab-results",
      createEhrData: "POST /api/ehr-data",
      createDoctorNote: "POST /api/doctor-notes",
      focus: "POST /api/focus",
      selectedItem: "POST /api/selected-item",
      clearSession: "DELETE /api/session",
    },
    sessionInfo:
      "Include X-Session-Id header or sessionId in body/query to use existing session",
  });
});

// Health check
app.get("/api/health", async (req, res) => {
  let redisStatus = "disconnected";

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.ping();
      redisStatus = "connected";
    } catch (error) {
      redisStatus = "error";
    }
  }

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    storage: isRedisConnected
      ? "redis (persistent)"
      : "in-memory (session-based)",
    redis: { status: redisStatus },
    activeSessions:
      inMemorySessions.size + (isRedisConnected ? " (+ Redis sessions)" : ""),
    sseConnections: Array.from(sseClientsBySession.entries()).map(
      ([sid, clients]) => ({
        sessionId: sid,
        clients: clients.size,
      })
    ),
  });
});

// Initialize Redis on startup
initRedis().catch((error) => {
  console.error("❌ Failed to initialize Redis on startup:", error);
  console.log("⚠️  Server will continue with in-memory storage");
});

// Export for Vercel serverless
module.exports = app;

// Start server (only in local development)
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(
      `📡 Session-based API available at http://localhost:${PORT}/api/`
    );
    console.log(
      `🔗 Redis URL configured: ${process.env.REDIS_URL ? "Yes" : "No"}`
    );
  });
}
