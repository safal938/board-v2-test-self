require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const redis = require("redis");

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
    console.warn("⚠️  REDIS_URL not configured, using static file storage");
    return false;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000, // 5 second timeout
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

    redisClient.on("ready", () => {
      console.log("✅ Redis ready");
      isRedisConnected = true;
    });

    redisClient.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });

    await redisClient.connect();
    console.log("✅ Redis client initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error.message);
    console.log("⚠️  Continuing with static file storage as fallback");
    isRedisConnected = false;
    redisClient = null;
    return false;
  }
};

// Simple in-memory list of SSE clients
const sseClients = new Set();

// Track currently selected item
let currentSelectedItem = {
  itemId: null,
  timestamp: null,
  item: null,
};

// Helper function to broadcast SSE messages
const broadcastSSE = (message) => {
  const eventType = message.event || "new-item";
  const data = { ...message };
  delete data.event; // Remove event from data payload

  for (const client of sseClients) {
    try {
      client.write(`event: ${eventType}\n`);
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  }
};

// SSE endpoint to push focus events to the frontend
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Allow CORS for SSE explicitly if proxying is not used
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Flush headers immediately
  if (res.flushHeaders) res.flushHeaders();

  // Initial event to confirm connection
  res.write("event: connected\n");
  res.write('data: "ok"\n\n');

  sseClients.add(res);

  // Keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\n`);
      res.write(`data: ${Date.now()}\n\n`);
    } catch (_) {
      // Ignore write errors, cleanup will remove the client
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    try {
      res.end();
    } catch (_) {}
  });
});

// Load static items from file (fallback and initialization)
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

// Load board items from Redis (with fallback to static data)
const loadBoardItems = async () => {
  // Ensure Redis is connected
  if (!isRedisConnected) {
    const connected = await initRedis();
    if (!connected) {
      console.log("⚠️  Redis not available, loading from static file");
      return await loadStaticItems();
    }
  }

  // Try Redis first
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get("boardItems");
      if (data) {
        const items = JSON.parse(data);
        console.log(
          `✅ Loaded ${items.length} items from Redis (persistent storage)`
        );
        return items;
      }
      console.log("📦 No items in Redis yet, initializing with static data");
    } catch (error) {
      console.error("❌ Redis read error:", error);
      console.log("⚠️  Falling back to static data");
    }
  }

  // Fallback to static data and initialize Redis
  const staticItems = await loadStaticItems();

  // Try to save to Redis for next time
  if (isRedisConnected && redisClient && staticItems.length > 0) {
    try {
      await redisClient.set("boardItems", JSON.stringify(staticItems));
      console.log("✅ Initialized Redis with static data");
    } catch (error) {
      console.error("❌ Failed to initialize Redis:", error);
    }
  }

  return staticItems;
};

// Save board items to Redis (persistent storage)
const saveBoardItems = async (items) => {
  // Ensure Redis is connected
  if (!isRedisConnected) {
    const connected = await initRedis();
    if (!connected) {
      throw new Error("Redis not available - cannot save items");
    }
  }

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set("boardItems", JSON.stringify(items));
      console.log(
        `✅ Saved ${items.length} items to Redis (persistent across all instances)`
      );
      return true;
    } catch (error) {
      console.error("❌ Redis write error:", error);
      throw error;
    }
  } else {
    console.error("❌ Redis not connected, cannot save items");
    throw new Error("Redis not available");
  }
};

// Collision detection function
const checkCollision = (item1, item2) => {
  // Skip collision check if either item has auto height (can't determine bounds)
  if (item1.height === "auto" || item2.height === "auto") {
    return false;
  }

  // Convert to numbers
  const h1 = typeof item1.height === "number" ? item1.height : 500;
  const h2 = typeof item2.height === "number" ? item2.height : 500;

  // Two rectangles overlap if they don't satisfy any of these conditions:
  const noCollision =
    item1.x + item1.width <= item2.x || // item1 is completely to the left
    item2.x + item2.width <= item1.x || // item1 is completely to the right
    item1.y + h1 <= item2.y || // item1 is completely above
    item2.y + h2 <= item1.y; // item1 is completely below

  return !noCollision;
};

// Task Management Zone boundaries
const TASK_ZONE = {
  x: 4200,
  y: 0,
  width: 2000,
  height: 2100,
};

// Retrieved Data Zone boundaries
const RETRIEVED_DATA_ZONE = {
  x: 4200,
  y: -4600,
  width: 2000,
  height: 2100,
};

// Estimate actual height of an item based on its content
const estimateItemHeight = (item) => {
  // If height is explicitly set and not 'auto', use it
  if (
    item.height &&
    item.height !== "auto" &&
    typeof item.height === "number"
  ) {
    return item.height;
  }

  // Estimate based on item type and content
  if (item.type === "todo" && item.todoData) {
    const baseHeight = 120; // Header + padding
    const mainTodoHeight = 50; // Height per main todo item
    const subTodoHeight = 30; // Height per sub-todo item
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

    return Math.min(Math.max(totalHeight, 200), 1200); // Min 200px, max 1200px
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

  // Default fallback
  return 450;
};

// Find position within Task Management Zone with proper spacing and collision detection
const findTaskZonePosition = (newItem, existingItems) => {
  const padding = 60; // Space between items (increased for better vertical spacing)
  const colWidth = 520; // Standard column width for items
  const startX = TASK_ZONE.x + 60; // Start 60px from left edge
  const startY = TASK_ZONE.y + 60; // Start 60px from top edge
  const maxColumns = 3; // Maximum 3 columns

  // Filter existing items to only those in the Task Management Zone
  const taskZoneItems = existingItems.filter(
    (item) =>
      item.x >= TASK_ZONE.x &&
      item.x < TASK_ZONE.x + TASK_ZONE.width &&
      item.y >= TASK_ZONE.y &&
      item.y < TASK_ZONE.y + TASK_ZONE.height &&
      item.type === "todo"
  );

  console.log(
    `🎯 Finding position in Task Management Zone for ${newItem.type} item`
  );
  console.log(
    `📊 Found ${taskZoneItems.length} existing API items in Task Zone`
  );

  // Estimate height of new item
  const newItemHeight = estimateItemHeight(newItem);
  const newItemWidth = newItem.width || colWidth;

  console.log(
    `📏 Estimated new item dimensions: ${newItemWidth}w × ${newItemHeight}h`
  );

  // Create columns to track Y positions
  const columns = Array(maxColumns).fill(startY);

  // Place existing items into columns based on their X position
  taskZoneItems.forEach((item) => {
    const col = Math.floor((item.x - startX) / (colWidth + padding));
    if (col >= 0 && col < maxColumns) {
      const itemHeight = estimateItemHeight(item);
      const itemBottom = item.y + itemHeight + padding;

      // Update column height if this item extends further down
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

  // Find the column with the lowest Y position (most space available)
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

  // Check if position is within zone bounds
  if (y + newItemHeight > TASK_ZONE.y + TASK_ZONE.height) {
    console.log(`⚠️  Item would exceed zone height, placing at bottom of zone`);
    // If it exceeds, try to find space in another column or place at the top of the next column
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
  const padding = 60; // Space between items
  const colWidth = 520; // Standard column width for items
  const startX = zoneConfig.x + 60; // Start 60px from left edge
  const startY = zoneConfig.y + 60; // Start 60px from top edge
  const maxColumns = Math.floor(
    (zoneConfig.width - 120) / (colWidth + padding)
  ); // Calculate max columns based on zone width

  // Filter existing items to only those in the specified zone
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

  // Estimate height of new item
  const newItemHeight = estimateItemHeight(newItem);
  const newItemWidth = newItem.width || colWidth;

  console.log(
    `📏 Estimated new item dimensions: ${newItemWidth}w × ${newItemHeight}h`
  );

  // Create columns to track Y positions
  const columns = Array(maxColumns).fill(startY);

  // Place existing items into columns based on their X position
  zoneItems.forEach((item) => {
    const col = Math.floor((item.x - startX) / (colWidth + padding));
    if (col >= 0 && col < maxColumns) {
      const itemHeight = estimateItemHeight(item);
      const itemBottom = item.y + itemHeight + padding;

      // Update column height if this item extends further down
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

  // Find the column with the lowest Y position (most space available)
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

  // Check if position is within zone bounds
  if (y + newItemHeight > zoneConfig.y + zoneConfig.height) {
    console.log(`⚠️  Item would exceed zone height, trying other columns`);
    // If it exceeds, try to find space in another column
    for (let col = 0; col < maxColumns; col++) {
      if (columns[col] + newItemHeight <= zoneConfig.y + zoneConfig.height) {
        const altX = startX + col * (colWidth + padding);
        const altY = columns[col];
        console.log(`✅ Found space in column ${col} at (${altX}, ${altY})`);
        return { x: altX, y: altY };
      }
    }
    // If no space found, place at top of first column (will overlap)
    console.log(`⚠️  No space found, placing at top of zone`);
    return { x: startX, y: startY };
  }

  console.log(`✅ Placing item in column ${bestCol} at (${x}, ${y})`);

  return { x, y };
};

// Doctor's Notes Zone boundaries
const DOCTORS_NOTE_ZONE = {
  x: 4200,
  y: -2300,
  width: 2000,
  height: 2100,
};

// Find position within Doctor's Notes Zone with proper spacing
const findDoctorsNotePosition = (newItem, existingItems) => {
  const padding = 50; // Space between items and zone border
  const rowHeight = 620; // Standard row height for notes (600px + 20px spacing)
  const colWidth = 470; // Standard column width for notes (450px + 20px spacing)

  // Filter existing items to only those in the Doctor's Notes Zone
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

  // Calculate grid positions
  const maxCols = Math.floor(DOCTORS_NOTE_ZONE.width / colWidth);
  const maxRows = Math.floor(DOCTORS_NOTE_ZONE.height / rowHeight);

  console.log(
    `📐 Grid capacity: ${maxCols} columns × ${maxRows} rows = ${
      maxCols * maxRows
    } positions`
  );

  // Create a grid to track occupied positions
  const grid = Array(maxRows)
    .fill(null)
    .map(() => Array(maxCols).fill(false));

  // Mark occupied positions
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

  // Find first available position (left to right, top to bottom)
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

  // If no grid position available, stack vertically in first column
  const x = DOCTORS_NOTE_ZONE.x + padding;
  const y = DOCTORS_NOTE_ZONE.y + padding + noteZoneItems.length * rowHeight;

  console.log(`⚠️  Grid full, stacking vertically at (${x}, ${y})`);
  return { x, y };
};

// Find position within Retrieved Data Zone with proper spacing
const findRetrievedDataZonePosition = (newItem, existingItems) => {
  const padding = 60; // Space between items and zone border (increased for better spacing)
  const rowHeight = 490; // Standard row height for items (450px + 40px spacing)
  const colWidth = 560; // Standard column width for items (520px item + 40px spacing)

  // Filter existing items to only those in the Retrieved Data Zone
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

  // Calculate grid positions
  const maxCols = Math.floor(RETRIEVED_DATA_ZONE.width / colWidth);
  const maxRows = Math.floor(RETRIEVED_DATA_ZONE.height / rowHeight);

  console.log(
    `📐 Grid capacity: ${maxCols} columns × ${maxRows} rows = ${
      maxCols * maxRows
    } positions`
  );

  // Create a grid to track occupied positions
  const grid = Array(maxRows)
    .fill(null)
    .map(() => Array(maxCols).fill(false));

  // Mark occupied positions
  retrievedDataZoneItems.forEach((item) => {
    const col = Math.floor((item.x - RETRIEVED_DATA_ZONE.x) / colWidth);
    const row = Math.floor((item.y - RETRIEVED_DATA_ZONE.y - 60) / rowHeight); // Adjust for starting Y offset

    if (row >= 0 && row < maxRows && col >= 0 && col < maxCols) {
      grid[row][col] = true;
      console.log(`🔒 Position occupied: row ${row}, col ${col} by ${item.id}`);
    }
  });

  // Find first available position (left to right, top to bottom)
  for (let row = 0; row < maxRows; row++) {
    for (let col = 0; col < maxCols; col++) {
      if (!grid[row][col]) {
        const x = RETRIEVED_DATA_ZONE.x + col * colWidth + padding;
        const y = RETRIEVED_DATA_ZONE.y + row * rowHeight + 60; // Start at 60px from top of zone

        console.log(
          `✅ Found available position: row ${row}, col ${col} at (${x}, ${y})`
        );
        return { x, y };
      }
    }
  }

  // If no grid position available, stack vertically in first column
  const x = RETRIEVED_DATA_ZONE.x + padding;
  const y =
    RETRIEVED_DATA_ZONE.y +
    60 +
    retrievedDataZoneItems.length * (rowHeight + padding);

  console.log(`⚠️  Grid full, stacking vertically at (${x}, ${y})`);
  return { x, y };
};

// Legacy collision detection for non-API items - Find non-overlapping position for new item
const findNonOverlappingPosition = (newItem, existingItems) => {
  const padding = 20; // Minimum gap between items
  const maxAttempts = 50; // Prevent infinite loops
  let attempts = 0;

  // Start with the original position
  let testX = newItem.x;
  let testY = newItem.y;

  // If no position specified, start at a random location
  if (!newItem.x || !newItem.y) {
    testX = Math.random() * 8000 + 100;
    testY = Math.random() * 7000 + 100;
  }

  console.log(
    `🔍 Checking collision for new item at (${testX}, ${testY}) with ${existingItems.length} existing items`
  );

  // Log all existing items for debugging
  existingItems.forEach((item, index) => {
    console.log(
      `  Existing item ${index}: ${item.id} at (${item.x}, ${item.y}) size (${item.width}, ${item.height})`
    );
  });

  while (attempts < maxAttempts) {
    let hasCollision = false;
    let collidingItem = null;

    // Check collision with all existing items
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
        collidingItem = existingItem;
        break;
      }
    }

    // If no collision found, use this position
    if (!hasCollision) {
      console.log(`✅ No collision found, using position (${testX}, ${testY})`);
      return { x: testX, y: testY };
    }

    // Move to next position (below existing items)
    // Strategy: Find the bottom-most item and place below it
    let maxBottom = 0;
    for (const existingItem of existingItems) {
      const bottom = existingItem.y + existingItem.height;
      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
    }

    // Place below the bottom-most item with padding
    testY = maxBottom + padding;

    console.log(
      `📍 Moving to position below bottom-most item: (${testX}, ${testY})`
    );

    // If we're too far down, try a new random X position
    if (testY > 8000) {
      testX = Math.random() * 8000 + 100;
      testY = Math.random() * 7000 + 100;
      console.log(
        `🔄 Canvas too crowded, trying new random position: (${testX}, ${testY})`
      );
    }

    attempts++;
  }

  // If we couldn't find a non-overlapping position, use the last calculated position
  console.log(
    `⚠️  Could not find non-overlapping position after ${attempts} attempts, using fallback position (${testX}, ${testY})`
  );
  return { x: testX, y: testY };
};

// Helper function to update height in source data file
const updateSourceDataHeight = async (itemId, newHeight) => {
  try {
    const sourceDataPath = path.join(
      __dirname,
      "..",
      "src",
      "data",
      "boardItems.json"
    );
    const sourceData = await fs.readFile(sourceDataPath, "utf8");
    const sourceItems = JSON.parse(sourceData);

    const itemIndex = sourceItems.findIndex((item) => item.id === itemId);
    if (itemIndex !== -1) {
      sourceItems[itemIndex].height = newHeight;
      await fs.writeFile(sourceDataPath, JSON.stringify(sourceItems, null, 2));
      console.log(
        `📏 Updated height for item ${itemId} in source data: ${newHeight}px`
      );
    }
  } catch (error) {
    console.log("Could not update source data height:", error.message);
  }
};

// GET /api/board-items - Get all board items (merged from both sources)
app.get("/api/board-items", async (req, res) => {
  try {
    // Load items from backend storage
    const backendItems = await loadBoardItems();

    // Load items from source data
    const sourceDataPath = path.join(
      __dirname,
      "..",
      "src",
      "data",
      "boardItems.json"
    );
    let sourceItems = [];
    try {
      const sourceData = await fs.readFile(sourceDataPath, "utf8");
      sourceItems = JSON.parse(sourceData);
    } catch (error) {
      console.log("Source data not found, using only backend items");
    }

    // Merge items, with backend items taking priority over source items
    const backendIds = new Set(backendItems.map((item) => item.id));
    const uniqueSourceItems = sourceItems.filter(
      (item) => !backendIds.has(item.id)
    );
    const mergedItems = [...backendItems, ...uniqueSourceItems];

    console.log(
      `📊 Merged board items: ${backendItems.length} backend + ${uniqueSourceItems.length} unique source = ${mergedItems.length} total`
    );

    res.json(mergedItems);
  } catch (error) {
    console.error("Error loading board items:", error);
    res.status(500).json({ error: "Failed to load board items" });
  }
});

// POST /api/board-items - Create a new board item
app.post("/api/board-items", async (req, res) => {
  try {
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

    // Validate required fields
    if (!type) {
      return res.status(400).json({ error: "Type is required" });
    }

    // Generate unique ID
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set default values based on type
    let defaultWidth, defaultHeight, defaultColor, defaultContent;

    if (type === "component") {
      // Component-specific defaults
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
      // Legacy item types
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

    // Create new board item
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

    // Load existing items and add new one
    const existingItems = await loadBoardItems();
    const updatedItems = [...existingItems, newItem];

    // Save updated items
    await saveBoardItems(updatedItems);

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating board item:", error);
    res.status(500).json({ error: "Failed to create board item" });
  }
});

// PUT /api/board-items/:id - Update a board item
app.put("/api/board-items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const items = await loadBoardItems();
    const itemIndex = items.findIndex((item) => item.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Board item not found" });
    }

    // Update the item
    items[itemIndex] = {
      ...items[itemIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await saveBoardItems(items);

    // If height was updated, also update the source data file
    if (updates.height !== undefined) {
      await updateSourceDataHeight(id, updates.height);
    }

    res.json(items[itemIndex]);
  } catch (error) {
    console.error("Error updating board item:", error);
    res.status(500).json({ error: "Failed to update board item" });
  }
});

// DELETE /api/board-items/:id - Delete a board item
app.delete("/api/board-items/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const items = await loadBoardItems();
    const filteredItems = items.filter((item) => item.id !== id);

    if (filteredItems.length === items.length) {
      return res.status(404).json({ error: "Board item not found" });
    }

    await saveBoardItems(filteredItems);

    res.json({ message: "Board item deleted successfully" });
  } catch (error) {
    console.error("Error deleting board item:", error);
    res.status(500).json({ error: "Failed to delete board item" });
  }
});

// POST /api/todos - Create a new TODO board item
app.post("/api/todos", async (req, res) => {
  try {
    const { title, description, todo_items } = req.body || {};

    if (!title || !Array.isArray(todo_items)) {
      return res.status(400).json({
        error: "title (string) and todo_items (array) are required",
      });
    }

    // Normalize todo items: accept strings or { text, status }
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

    // Calculate dynamic height based on todo items
    const calculateTodoHeight = (todos, description) => {
      const baseHeight = 80; // Header + padding
      const itemHeight = 35; // Height per todo item
      const descriptionHeight = description ? 20 : 0; // Extra height for description
      const padding = 20; // Bottom padding

      const totalItems = todos.length;
      const contentHeight =
        baseHeight + totalItems * itemHeight + descriptionHeight + padding;

      return Math.min(Math.max(contentHeight, 200), 600); // Min 200px, max 600px
    };

    // Build item
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const dynamicHeight = calculateTodoHeight(todos, description);

    // Load existing items for positioning BEFORE creating the item
    const existingItems = await loadBoardItems();
    console.log(
      `🔍 Loaded ${existingItems.length} existing items for positioning`
    );

    // Determine position - use Task Zone if no coordinates provided
    let itemX, itemY;
    if (req.body.x !== undefined && req.body.y !== undefined) {
      // Manual positioning - use provided coordinates
      itemX = req.body.x;
      itemY = req.body.y;
      console.log(
        `📍 Using provided coordinates for TODO item at (${itemX}, ${itemY})`
      );
    } else {
      // Auto-positioning - use Task Zone
      const tempItem = { type: "todo", width: 420, height: dynamicHeight };
      const taskPosition = findTaskZonePosition(tempItem, existingItems);
      itemX = taskPosition.x;
      itemY = taskPosition.y;
      console.log(
        `📍 Auto-positioned TODO item in Task Zone at (${itemX}, ${itemY})`
      );
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
      todoData: {
        title,
        description: description || "",
        todos,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist
    const items = [...existingItems, newItem];
    await saveBoardItems(items);

    // Notify live clients via SSE (new-item)
    const payload = {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    };
    broadcastSSE(payload);

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating todo item:", error);
    res.status(500).json({ error: "Failed to create todo item" });
  }
});

// POST /api/agents - Create a new agent result item
app.post("/api/agents", async (req, res) => {
  try {
    const { title, content, zone } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        error: "title (string) and content (string) are required",
      });
    }

    // Zone configuration mapping
    const zoneConfig = {
      "task-management-zone": { x: 4200, y: 0, width: 2000, height: 2100 },
      "retrieved-data-zone": { x: 4200, y: -4600, width: 2000, height: 2100 },
      "doctors-note-zone": { x: 4200, y: -2300, width: 2000, height: 2100 },
      "adv-event-zone": { x: 0, y: 0, width: 4000, height: 2300 },
      "data-zone": { x: 0, y: -1300, width: 4000, height: 1000 },
      "raw-ehr-data-zone": { x: 0, y: -4600, width: 4000, height: 3000 },
      "web-interface-zone": { x: -2200, y: 0, width: 2000, height: 1500 },
    };

    // Calculate dynamic height based on content
    const calculateHeight = (content) => {
      const baseHeight = 80; // Header + padding
      const lineHeight = 20; // Approximate line height
      const maxWidth = 520; // Container width

      // Estimate lines based on content length and width
      const estimatedLines = Math.ceil(content.length / (maxWidth / 12)); // 12px char width
      const contentHeight = Math.max(estimatedLines * lineHeight, 100); // Minimum 100px

      return Math.min(baseHeight + contentHeight, 800); // Cap at 800px
    };

    // Build item
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const dynamicHeight = calculateHeight(content);

    // Load existing items for positioning BEFORE creating the item
    const existingItems = await loadBoardItems();
    console.log(
      `🔍 Loaded ${existingItems.length} existing items for positioning`
    );

    // Determine position based on zone parameter
    let itemX, itemY;
    if (req.body.x !== undefined && req.body.y !== undefined) {
      // Manual positioning - use provided coordinates
      itemX = req.body.x;
      itemY = req.body.y;
      console.log(
        `📍 Using provided coordinates for AGENT item at (${itemX}, ${itemY})`
      );
    } else if (zone && zoneConfig[zone]) {
      // Zone-based positioning
      const targetZone = zoneConfig[zone];
      const tempItem = { type: "agent", width: 520, height: dynamicHeight };

      // Find position within specified zone
      const zonePosition = findPositionInZone(
        tempItem,
        existingItems,
        targetZone
      );
      itemX = zonePosition.x;
      itemY = zonePosition.y;
      console.log(
        `📍 Auto-positioned AGENT item in ${zone} at (${itemX}, ${itemY})`
      );
    } else {
      // Default: Auto-positioning - use Task Zone
      const tempItem = { type: "agent", width: 520, height: dynamicHeight };
      const taskPosition = findTaskZonePosition(tempItem, existingItems);
      itemX = taskPosition.x;
      itemY = taskPosition.y;
      console.log(
        `📍 Auto-positioned AGENT item in Task Zone (default) at (${itemX}, ${itemY})`
      );
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
      agentData: {
        title,
        markdown: content,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist
    const items = [...existingItems, newItem];
    await saveBoardItems(items);

    // Notify live clients via SSE (new-item)
    const payload = {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    };
    broadcastSSE(payload);

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating agent item:", error);
    res.status(500).json({ error: "Failed to create agent item" });
  }
});

// POST /api/lab-results - Create a new lab result board item
app.post("/api/lab-results", async (req, res) => {
  try {
    const { parameter, value, unit, status, range, trend } = req.body || {};

    if (!parameter || !value || !unit || !status || !range) {
      return res.status(400).json({
        error: "parameter, value, unit, status, and range are required",
      });
    }

    // Validate status
    const validStatuses = ["optimal", "warning", "critical"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "status must be one of: optimal, warning, critical",
      });
    }

    // Validate range
    if (!range.min || !range.max || range.min >= range.max) {
      return res.status(400).json({
        error: "range must have valid min and max values where min < max",
      });
    }

    // Build item
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Load existing items for positioning BEFORE creating the item
    const existingItems = await loadBoardItems();
    console.log(
      `🔍 Loaded ${existingItems.length} existing items for positioning`
    );

    // Determine position - use Task Zone if no coordinates provided
    let itemX, itemY;
    if (req.body.x !== undefined && req.body.y !== undefined) {
      // Manual positioning - use provided coordinates
      itemX = req.body.x;
      itemY = req.body.y;
      console.log(
        `📍 Using provided coordinates for LAB RESULT item at (${itemX}, ${itemY})`
      );
    } else {
      // Auto-positioning - use Retrieved Data Zone
      const tempItem = { type: "lab-result", width: 400, height: 280 };
      const retrievedDataPosition = findRetrievedDataZonePosition(
        tempItem,
        existingItems
      );
      itemX = retrievedDataPosition.x;
      itemY = retrievedDataPosition.y;
      console.log(
        `📍 Auto-positioned LAB RESULT item in Retrieved Data Zone at (${itemX}, ${itemY})`
      );
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

    // Persist
    const items = [...existingItems, newItem];
    await saveBoardItems(items);

    // Notify live clients via SSE (new-item)
    const sseMessage = {
      type: "new-item",
      item: newItem,
    };
    broadcastSSE(sseMessage);

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating lab result:", error);
    res.status(500).json({ error: "Failed to create lab result" });
  }
});

// POST /api/ehr-data - Create a new EHR data item in Retrieved Data Zone
app.post("/api/ehr-data", async (req, res) => {
  try {
    const { title, content, dataType, source, x, y, width, height } =
      req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        error: "Title and content are required for EHR data items",
      });
    }

    const existingItems = await loadBoardItems();
    const itemId = `item-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Determine positioning
    let itemX, itemY;
    if (x !== undefined && y !== undefined) {
      itemX = x;
      itemY = y;
      console.log(
        `📍 Using provided coordinates for EHR DATA item at (${itemX}, ${itemY})`
      );
    } else {
      // Auto-positioning - use Retrieved Data Zone
      const tempItem = {
        type: "ehr-data",
        width: width || 400,
        height: height || 300,
      };
      const retrievedDataPosition = findRetrievedDataZonePosition(
        tempItem,
        existingItems
      );
      itemX = retrievedDataPosition.x;
      itemY = retrievedDataPosition.y;
      console.log(
        `📍 Auto-positioned EHR DATA item in Retrieved Data Zone at (${itemX}, ${itemY})`
      );
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

    // Add to items array
    existingItems.push(newItem);

    // Save to file
    await saveBoardItems(existingItems);

    console.log(`✅ Created EHR data item: ${itemId} - "${title}"`);

    // Notify live clients via SSE (new-item)
    const sseMessage = {
      type: "new-item",
      item: newItem,
    };
    broadcastSSE(sseMessage);

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating EHR data item:", error);
    res.status(500).json({ error: "Failed to create EHR data item" });
  }
});

// POST /api/components - Create a new dashboard component
app.post("/api/components", async (req, res) => {
  try {
    const { componentType, x, y, width, height, props } = req.body;

    if (!componentType) {
      return res.status(400).json({
        error: "componentType is required",
      });
    }

    // Set default dimensions based on component type
    let defaultWidth, defaultHeight;
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

    const id = `dashboard-item-${componentType.toLowerCase()}-${Date.now()}`;

    const newItem = {
      id,
      type: "component",
      componentType,
      x: x || Math.random() * 8000 + 100,
      y: y || Math.random() * 7000 + 100,
      width: width || defaultWidth,
      height: height || defaultHeight,
      content: {
        title: componentType,
        props: props || {},
      },
      color: "#ffffff",
      rotation: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Load existing items for collision detection
    const existingItems = await loadBoardItems();
    console.log(
      `🔍 Loaded ${existingItems.length} existing items for collision detection`
    );

    // Find non-overlapping position
    const finalPosition = findNonOverlappingPosition(newItem, existingItems);
    newItem.x = finalPosition.x;
    newItem.y = finalPosition.y;

    console.log(
      `📍 Positioned new ${componentType} component at (${newItem.x}, ${newItem.y})`
    );

    // Persist
    const items = [...existingItems, newItem];
    await saveBoardItems(items);

    // Notify live clients via SSE
    const payload = {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    };
    broadcastSSE(payload);

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating component:", error);
    res.status(500).json({ error: "Failed to create component" });
  }
});

// POST /api/enhanced-todo - Create enhanced todo with agent delegation
app.post("/api/enhanced-todo", async (req, res) => {
  try {
    const {
      title,
      description,
      todos,
      x,
      y,
      width = 450,
      height = "auto",
      color = "#ffffff",
      dataSource = "Manual Entry",
    } = req.body;

    // Validate required fields
    if (!title || !todos || !Array.isArray(todos)) {
      return res.status(400).json({
        error: "title and todos array are required",
      });
    }

    // Validate and generate IDs for todo items
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

      // Generate unique task ID if not provided
      if (!todo.id) {
        const taskId = `task-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 6)}-${i}`;
        todo.id = taskId;
        console.log(`🔧 Generated task ID: ${taskId} for task: ${todo.text}`);
      } else {
        console.log(
          `✅ Using provided task ID: ${todo.id} for task: ${todo.text}`
        );
      }

      // Ensure the ID is set in the todos array
      todos[i] = todo;

      // Validate sub-todos if they exist
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

    // Generate unique ID
    const id = `enhanced-todo-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Load existing items for positioning BEFORE creating the item
    const existingItems = await loadBoardItems();
    console.log(
      `🔍 Loaded ${existingItems.length} existing items for positioning`
    );

    // Determine position - use Task Zone if no coordinates provided
    let itemX, itemY;
    if (x !== undefined && y !== undefined) {
      // Manual positioning - use provided coordinates
      itemX = x;
      itemY = y;
      console.log(
        `📍 Using provided coordinates for ENHANCED TODO item at (${itemX}, ${itemY})`
      );
    } else {
      // Auto-positioning - use Task Zone with estimated height
      const tempItem = {
        type: "todo",
        width: width,
        height: height,
        todoData: { todos, description },
      };
      const taskPosition = findTaskZonePosition(tempItem, existingItems);
      itemX = taskPosition.x;
      itemY = taskPosition.y;
      console.log(
        `📍 Auto-positioned ENHANCED TODO item in Task Zone at (${itemX}, ${itemY})`
      );
    }

    // Create the new enhanced todo item
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

    console.log(
      `📍 Positioned new enhanced todo at (${newItem.x}, ${newItem.y})`
    );

    // Save to board items
    const updatedItems = [...existingItems, newItem];
    await saveBoardItems(updatedItems);

    // Broadcast to all connected clients
    const payload = {
      event: "new-item",
      item: newItem,
      timestamp: new Date().toISOString(),
      action: "created",
    };
    broadcastSSE(payload);

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating enhanced todo:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      error: "Failed to create enhanced todo",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// POST /api/doctor-notes - Create a new doctor's note
app.post("/api/doctor-notes", async (req, res) => {
  console.log("📝 POST /api/doctor-notes - Creating doctor's note");

  try {
    const { content, x, y, width, height } = req.body || {};

    // Generate unique ID
    const noteId = `doctor-note-${Date.now()}`;

    // Determine position - use provided or default to Doctor's Note Zone
    const noteX = x !== undefined ? x : 4300;
    const noteY = y !== undefined ? y : -2200;
    const noteWidth = width || 450;
    const noteHeight = height || 600;

    // Create note item
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

    // Load existing items
    const items = await loadBoardItems();

    // Find optimal position in Doctor's Notes Zone
    const position = findDoctorsNotePosition(noteItem, items);
    noteItem.x = position.x;
    noteItem.y = position.y;

    // Add to items
    items.push(noteItem);

    // Save to file
    await saveBoardItems(items);

    console.log(
      `✅ Created doctor's note: ${noteId} at (${position.x}, ${position.y})`
    );

    // Broadcast to SSE clients
    broadcastSSE({
      type: "new-item",
      item: noteItem,
    });

    res.status(201).json({
      success: true,
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

// POST /api/focus - Focus on a specific canvas item (enhanced with sub-element support)
app.post("/api/focus", (req, res) => {
  const { objectId, itemId, subElement, focusOptions } = req.body;

  // Support both objectId (legacy) and itemId (new)
  const targetId = itemId || objectId;

  if (!targetId) {
    return res.status(400).json({
      error: "objectId or itemId is required",
    });
  }

  // Default options - higher zoom for sub-elements
  const defaultOptions = {
    zoom: subElement ? 1.5 : 1.2,
    highlight: !!subElement,
    duration: subElement ? 1500 : 1200,
    scrollIntoView: true,
  };

  const options = { ...defaultOptions, ...(focusOptions || {}) };

  console.log(
    `🎯 Focus request: ${targetId}${subElement ? `#${subElement}` : ""}`
  );

  // Broadcast focus event to all connected SSE clients
  const payload = {
    event: "focus",
    objectId: targetId, // Keep legacy field for compatibility
    itemId: targetId,
    subElement: subElement || null,
    focusOptions: options,
    timestamp: new Date().toISOString(),
  };

  broadcastSSE(payload);

  // Return success
  res.json({
    success: true,
    message: `Focus event broadcasted`,
    itemId: targetId,
    subElement: subElement || null,
    focusOptions: options,
  });
});

// ============================================================================
// EASL IFRAME CHATBOT - COMMENTED OUT
// See: documenatation/IFRAME_CHATBOT_RESTORATION_GUIDE.md for restoration
// ============================================================================

// // POST /api/send-to-easl - Send query to EASL iframe via SSE
// app.post("/api/send-to-easl", (req, res) => {
//   const { query, metadata } = req.body;

//   if (!query) {
//     return res.status(400).json({ error: "Query is required" });
//   }

//   console.log("📨 Sending query to EASL:", query);

//   // Broadcast via SSE to all connected clients
//   sseClients.forEach((client) => {
//     client.write(`event: easl-query\n`);
//     client.write(`data: ${JSON.stringify({ query, metadata })}\n\n`);
//   });

//   res.json({
//     success: true,
//     message: "Query sent to EASL",
//     query,
//     metadata,
//   });
// });

// // POST /api/easl-response - Receive complete response from EASL chat app
// app.post("/api/easl-response", async (req, res) => {
//   const { response_type, query, response, metadata } = req.body;

//   try {
//     // Only process complete responses
//     if (response_type !== 'complete') {
//       return res.status(400).json({
//         error: "Only complete responses are accepted",
//         received_type: response_type
//       });
//     }

//     if (!query || !response) {
//       return res.status(400).json({
//         error: "query and response are required"
//       });
//     }

//     console.log("📥 Received complete response from EASL");
//     console.log("   Query:", query);
//     console.log("   Response length:", response.length, "characters");

//     // Load existing board items
//     const items = await loadBoardItems();

//     // Find the EASL iframe item
//     const easlItemIndex = items.findIndex(item => item.id === "iframe-item-easl-interface");

//     if (easlItemIndex === -1) {
//       console.warn("⚠️  EASL iframe item not found in board items");
//       return res.status(404).json({
//         error: "EASL iframe item not found"
//       });
//     }

//     // Initialize conversationHistory if it doesn't exist
//     if (!items[easlItemIndex].conversationHistory) {
//       items[easlItemIndex].conversationHistory = [];
//     }

//     // Add the conversation to history
//     const conversationEntry = {
//       id: `conv-${Date.now()}`,
//       query: query,
//       response: response,
//       timestamp: new Date().toISOString(),
//       metadata: metadata || {},
//       response_type: response_type
//     };

//     items[easlItemIndex].conversationHistory.push(conversationEntry);
//     items[easlItemIndex].updatedAt = new Date().toISOString();

//     // Keep only last 100 conversations to prevent file from growing too large
//     if (items[easlItemIndex].conversationHistory.length > 100) {
//       items[easlItemIndex].conversationHistory = items[easlItemIndex].conversationHistory.slice(-100);
//     }

//     // Save updated items to storage
//     await saveBoardItems(items);

//     console.log("✅ EASL response saved to board items");
//     console.log(`   Total conversations: ${items[easlItemIndex].conversationHistory.length}`);

//     res.json({
//       success: true,
//       message: "Response saved successfully",
//       conversationId: conversationEntry.id,
//       totalConversations: items[easlItemIndex].conversationHistory.length
//     });

//   } catch (error) {
//     console.error("❌ Error saving EASL response:", error);
//     res.status(500).json({
//       error: "Failed to save EASL response",
//       details: error.message
//     });
//   }
// });

// // GET /api/easl-history - Get conversation history from EASL
// app.get("/api/easl-history", async (req, res) => {
//   try {
//     const items = await loadBoardItems();
//     const easlItem = items.find(item => item.id === "iframe-item-easl-interface");

//     if (!easlItem) {
//       return res.status(404).json({
//         error: "EASL iframe item not found"
//       });
//     }

//     const conversationHistory = easlItem.conversationHistory || [];
//     const limit = parseInt(req.query.limit) || conversationHistory.length;

//     res.json({
//       success: true,
//       totalConversations: conversationHistory.length,
//       conversations: conversationHistory.slice(-limit)
//     });

//   } catch (error) {
//     console.error("❌ Error retrieving EASL history:", error);
//     res.status(500).json({
//       error: "Failed to retrieve EASL history",
//       details: error.message
//     });
//   }
// });

// ============================================================================
// END EASL IFRAME CHATBOT
// ============================================================================

// POST /api/selected-item - Update currently selected item
app.post("/api/selected-item", async (req, res) => {
  const { selectedItemId } = req.body;

  try {
    if (!selectedItemId) {
      // Clear selection
      currentSelectedItem = {
        itemId: null,
        timestamp: null,
        item: null,
      };
      console.log("🔵 Selection cleared");
    } else {
      // Load items to get full item details
      const items = await loadBoardItems();
      const item = items.find((i) => i.id === selectedItemId);

      currentSelectedItem = {
        itemId: selectedItemId,
        timestamp: new Date().toISOString(),
        item: item || null,
      };

      console.log("🔵 Item selected:", selectedItemId, item?.type || "unknown");
    }

    res.json({
      success: true,
      selectedItemId: currentSelectedItem.itemId,
      timestamp: currentSelectedItem.timestamp,
    });
  } catch (error) {
    console.error("Error updating selected item:", error);
    res.status(500).json({ error: "Failed to update selected item" });
  }
});

// GET /api/selected-item - Get currently selected/active item
app.get("/api/selected-item", async (req, res) => {
  try {
    if (!currentSelectedItem.itemId) {
      return res.json({
        selected: false,
        message: "No item currently selected",
        selectedItem: null,
      });
    }

    // Refresh item data from current board state
    const items = await loadBoardItems();
    const item = items.find((i) => i.id === currentSelectedItem.itemId);

    if (!item) {
      // Item no longer exists, clear selection
      currentSelectedItem = {
        itemId: null,
        timestamp: null,
        item: null,
      };

      return res.json({
        selected: false,
        message: "Previously selected item no longer exists",
        selectedItem: null,
      });
    }

    res.json({
      selected: true,
      selectedItemId: currentSelectedItem.itemId,
      timestamp: currentSelectedItem.timestamp,
      selectedItem: {
        id: item.id,
        type: item.type,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        title: item.title || item.content?.title || null,
        content: item.content || null,
        // Include type-specific data
        ...(item.type === "todo" && { todoData: item.todoData }),
        ...(item.type === "agent" && { agentData: item.agentData }),
        ...(item.type === "lab-result" && { labData: item.labData }),
        ...(item.type === "ehr-data" && { ehrData: item.ehrData }),
        ...(item.type === "doctor-note" && { noteData: item.noteData }),
        ...(item.type === "component" && {
          componentType: item.componentType,
          props: item.content?.props,
        }),
      },
    });
  } catch (error) {
    console.error("Error getting selected item:", error);
    res.status(500).json({ error: "Failed to get selected item" });
  }
});

// POST /api/reset-cache - Force reload data from file
app.post("/api/reset-cache", async (req, res) => {
  try {
    // Simply reload from file - this clears any in-memory items
    const items = await loadBoardItems();
    console.log(`🔄 Cache reset: loaded ${items.length} items from file`);

    res.json({
      success: true,
      message: `Cache reset successfully. Loaded ${items.length} items from file.`,
      itemCount: items.length,
    });
  } catch (error) {
    console.error("Error resetting cache:", error);
    res.status(500).json({ error: "Failed to reset cache" });
  }
});

// DELETE /api/task-zone - Clear all API items from Task Management Zone
app.delete("/api/task-zone", async (req, res) => {
  try {
    const items = await loadBoardItems();

    // Filter out items in Task Management Zone that are API-created
    const filteredItems = items.filter((item) => {
      const inTaskZone =
        item.x >= TASK_ZONE.x &&
        item.x < TASK_ZONE.x + TASK_ZONE.width &&
        item.y >= TASK_ZONE.y &&
        item.y < TASK_ZONE.y + TASK_ZONE.height;

      const isApiItem = item.type === "todo";

      return !(inTaskZone && isApiItem);
    });

    const removedCount = items.length - filteredItems.length;

    await saveBoardItems(filteredItems);

    console.log(
      `🧹 Cleared ${removedCount} API items from Task Management Zone`
    );

    res.json({
      success: true,
      message: `Cleared ${removedCount} API items from Task Management Zone`,
      removedCount,
      remainingCount: filteredItems.length,
    });
  } catch (error) {
    console.error("Error clearing task zone:", error);
    res.status(500).json({ error: "Failed to clear task zone" });
  }
});

// DELETE /api/dynamic-items - Delete ALL dynamically added items (keeps only static data)
app.delete("/api/dynamic-items", async (req, res) => {
  try {
    console.log("🗑️  Deleting all dynamically added items...");

    // Load current items
    const currentItems = await loadBoardItems();
    console.log(`📊 Current total items: ${currentItems.length}`);

    // Load static items from source
    const sourceDataPath = path.join(__dirname, "data", "boardItems.json");
    const sourceData = await fs.readFile(sourceDataPath, "utf8");
    const staticItems = JSON.parse(sourceData);
    const staticIds = new Set(staticItems.map((item) => item.id));

    console.log(`📁 Static items: ${staticItems.length}`);

    // Filter to keep only static items
    const filteredItems = currentItems.filter((item) => staticIds.has(item.id));
    const removedCount = currentItems.length - filteredItems.length;

    // Save the filtered list
    await saveBoardItems(filteredItems);

    console.log(
      `✅ Removed ${removedCount} dynamic items, kept ${filteredItems.length} static items`
    );

    // Broadcast reset event to all connected clients
    broadcastSSE({
      event: "items-reset",
      message: "Dynamic items cleared",
      removedCount,
      remainingCount: filteredItems.length,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Deleted ${removedCount} dynamically added items. ${filteredItems.length} static items remain.`,
      removedCount,
      remainingCount: filteredItems.length,
      staticItemsCount: staticItems.length,
    });
  } catch (error) {
    console.error("❌ Error deleting dynamic items:", error);
    res.status(500).json({
      error: "Failed to delete dynamic items",
      details: error.message,
    });
  }
});

// Root API endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Canvas Board API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/api/health",
      boardItems: "/api/board-items",
      events: "/api/events (SSE)",
      joinMeeting: "/api/join-meeting",
      resetCache: "POST /api/reset-cache",
      clearTaskZone: "DELETE /api/task-zone",
      clearDynamicItems: "DELETE /api/dynamic-items",
    },
    documentation: "https://github.com/your-repo/board-v4-working",
  });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  let redisStatus = "disconnected";
  let redisInfo = null;

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.ping();
      redisStatus = "connected";
      const itemsData = await redisClient.get("boardItems");
      const itemCount = itemsData ? JSON.parse(itemsData).length : 0;
      redisInfo = {
        itemCount,
        configured: true,
      };
    } catch (error) {
      redisStatus = "error";
      redisInfo = { error: error.message };
    }
  } else if (process.env.REDIS_URL) {
    redisStatus = "configured but not connected";
  } else {
    redisStatus = "not configured";
  }

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    storage: isRedisConnected ? "redis (persistent)" : "fallback (static file)",
    redis: {
      status: redisStatus,
      ...redisInfo,
    },
  });
});

// Initialize Redis on startup
initRedis().catch((error) => {
  console.error("❌ Failed to initialize Redis on startup:", error);
  console.log("⚠️  Server will continue with static file fallback");
});

// Export for Vercel serverless
module.exports = app;

// Start server (only in local development)
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api/`);
    console.log(
      `🔗 Redis URL configured: ${process.env.REDIS_URL ? "Yes" : "No"}`
    );

    // Try to connect to Redis
    if (process.env.REDIS_URL) {
      console.log("🔄 Connecting to Redis...");
      const connected = await initRedis();
      if (connected) {
        console.log("✅ Redis connection successful");
      } else {
        console.log("⚠️  Redis connection failed, using static file fallback");
      }
    }
  });
}
