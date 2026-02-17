const { config } = require('./lib/config');
const express = require("express");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const http = require("http");
const https = require("https");
const { logger, requestLoggerMiddleware, installConsoleInterceptor } = require('./lib/logger');
const { requestMetricsMiddleware, inc, setGauge, snapshot } = require('./lib/metrics');
const { listSpreadsheetFiles, parseSplynxTasksFromFile, loadTaskIdsFromExcel, tryAutoLoadSpreadsheetIntoCache } = require('./lib/spreadsheetTasks');
const { LruTtlCache } = require('./lib/cache');
installConsoleInterceptor();
const app = express();
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(requestMetricsMiddleware);
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = config.PORT;

const { TrackerService } = require('./services/TrackerService');
const { NagiosService } = require('./services/NagiosService');
const { SplynxService } = require('./services/SplynxService');
const { WeatherBackend } = require('./services/WeatherBackend');

const TRACCAR_URL = config.TRACCAR_URL;
const USER = config.TRACCAR_USER;
const PASS = config.TRACCAR_PASS;
let ENABLE_TRACCAR = !!config.ENABLE_TRACCAR;

const SPLYNX_URL = config.SPLYNX_URL;
const SPLYNX_READ_ONLY_KEY = config.SPLYNX_READ_ONLY_KEY;
const SPLYNX_ASSIGN_KEY = config.SPLYNX_ASSIGN_KEY;
const SPLYNX_SECRET = config.SPLYNX_SECRET;
let ENABLE_SPLYNX_TASKS = !!config.ENABLE_SPLYNX_TASKS;

const NAGIOS_URL = config.NAGIOS_URL;
const NAGIOS_USER = config.NAGIOS_USER;
const NAGIOS_PASS = config.NAGIOS_PASS;
let ENABLE_NAGIOS = !!config.ENABLE_NAGIOS;

let ENABLE_WEATHER = !!config.ENABLE_WEATHER;

const GOOGLE_MAPS_KEY = config.GOOGLE_MAPS_KEY;
const OPENWEATHER_API_KEY = config.OPENWEATHER_API_KEY;
const ADMIN_TOKEN = config.ADMIN_TOKEN;
const SPLYNX_ADMIN_USER = config.SPLYNX_ADMIN_USER;
const SPLYNX_ADMIN_PASS = config.SPLYNX_ADMIN_PASS;

const initialReady = config.readiness();
if (!initialReady.ready) {
  logger.warn('readiness.startup_not_ready', { missing: initialReady.details.missing, warnings: initialReady.details.warnings });
}

const TRACKER_REFRESH_INTERVAL = 5000;
const NAGIOS_REFRESH_INTERVAL = 60000; // Increased from 30s to 1m
const TASKS_REFRESH_INTERVAL = 900000; // 15 minutes as requested
const WEATHER_REFRESH_INTERVAL = 30000; // 30 seconds for lightning/weather

const trackerService = new TrackerService({ baseUrl: TRACCAR_URL, user: USER, pass: PASS, enable: ENABLE_TRACCAR, dataDir: path.join(__dirname, 'Data', 'icons') });
const nagiosService = new NagiosService({ baseUrl: NAGIOS_URL, user: NAGIOS_USER, pass: NAGIOS_PASS, enable: ENABLE_NAGIOS, refreshMs: NAGIOS_REFRESH_INTERVAL });
const splynxService = new SplynxService({ baseUrl: SPLYNX_URL, readKey: SPLYNX_READ_ONLY_KEY, assignKey: SPLYNX_ASSIGN_KEY, secret: SPLYNX_SECRET, adminUser: SPLYNX_ADMIN_USER, adminPass: SPLYNX_ADMIN_PASS, enable: ENABLE_SPLYNX_TASKS });
const weatherBackend = new WeatherBackend({ apiKey: OPENWEATHER_API_KEY, dataDir: __dirname, enable: ENABLE_WEATHER });

const nagiosCache = new LruTtlCache({ name: 'nagios_status', ttlMs: NAGIOS_REFRESH_INTERVAL, maxSize: 1 });

const tasksCache = new LruTtlCache({ name: 'splynx_tasks', ttlMs: TASKS_REFRESH_INTERVAL, maxSize: 1 });
let tasksSourceFile = null;

let isFirstFetch = true;
let taskPaginationOffset = 0;

let adminsCache = {
  data: null,
  lastFetch: 0
};

let trackerCache = {
  data: null,
  lastFetch: 0
};

let devicesCache = {
  data: null,
  lastFetch: 0
};
let weatherCache = {
  data: null,
  lastFetch: 0
};

const coordWeatherCache = new Map();

// ADDED: API call tracking for OneCall API 3
const apiCallStats = {
  callsUsed: 0,
  callLimit: 500,
  startTime: Date.now(),
  resetTime: Date.now(),
};
// ADDED: Load API stats from storage if available
const API_STATS_FILE = path.join(__dirname, 'Data', 'weather-api-stats.json');

function _loadApiCallStatsFromDisk() {
  try {
    if (fs.existsSync(API_STATS_FILE)) {
      const raw = fs.readFileSync(API_STATS_FILE, 'utf8');
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        apiCallStats.callsUsed = Number.isFinite(obj.callsUsed) ? obj.callsUsed : apiCallStats.callsUsed;
        apiCallStats.callLimit = Number.isFinite(obj.callLimit) ? obj.callLimit : apiCallStats.callLimit;
        apiCallStats.startTime = obj.startTime || apiCallStats.startTime;
        apiCallStats.resetTime = obj.resetTime || apiCallStats.resetTime;
        console.log('[API Stats] Loaded stats from disk:', apiCallStats.callsUsed, '/', apiCallStats.callLimit);
      }
    }
  } catch (e) {
    console.warn('[API Stats] Failed to load stats from disk', e && e.message);
  }
}

function _saveApiCallStatsToDisk() {
  try {
    const dir = path.dirname(API_STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(API_STATS_FILE, JSON.stringify(apiCallStats, null, 2), 'utf8');
  } catch (e) {
    console.warn('[API Stats] Failed to save stats to disk', e && e.message);
  }
}

_loadApiCallStatsFromDisk();

// ADDED: Administrative Authentication Middleware
function adminAuth(req, res, next) {
    if (!ADMIN_TOKEN) {
        console.warn('[AUTH][ERROR] ADMIN_TOKEN not set in environment. Access denied.');
        return res.status(500).json({ 
            error: "Server authentication misconfigured",
            debug: "ADMIN_TOKEN environment variable is missing"
        });
    }

    const providedToken = req.headers['x-admin-token'];
    if (providedToken === ADMIN_TOKEN) {
        console.log(`[AUTH][SUCCESS] Authorized access to ${req.path} from ${req.ip}`);
        next();
    } else {
        console.warn(`[AUTH][FAILURE] Unauthorized access attempt to ${req.path} from ${req.ip}. Token provided: ${providedToken ? 'YES (masked)' : 'NO'}`);
        res.status(401).json({ 
            error: "Unauthorized",
            debug: "Invalid or missing X-Admin-Token header"
        });
    }
}


// ADDED: Read task IDs from Excel export to filter API requests

// ADDED: Helper to fetch tasks from Splynx with filtering
async function fetchTasksFromSplynx() {
  if (!ENABLE_SPLYNX_TASKS) {
    console.log("[Splynx] Task fetching is disabled via ENABLE_SPLYNX_TASKS");
    return [];
  }
  const allTaskIds = loadTaskIdsFromExcel(__dirname);
  
  if (allTaskIds.length === 0) {
    console.warn("[Splynx] No task IDs found in Excel. Fetching nothing.");
    return [];
  }

  let taskIds;
  if (isFirstFetch) {
    console.log(`[Splynx] First load: Fetching ALL ${allTaskIds.length} tasks from Excel list...`);
    taskIds = allTaskIds;
    isFirstFetch = false;
  } else {
    // Paginated fetch: 50 at a time, cycling through the list
    taskIds = allTaskIds.slice(taskPaginationOffset, taskPaginationOffset + 50);
    console.log(`[Splynx] Refreshing chunk of ${taskIds.length} tasks (Offset: ${taskPaginationOffset})...`);
    
    taskPaginationOffset += 50;
    if (taskPaginationOffset >= allTaskIds.length) {
      taskPaginationOffset = 0; // Reset to beginning for next cycle
    }
  }

  const tasks = await splynxService.fetchTasksByIds(taskIds);
  console.log(`[Splynx] 📦 Total tasks in this fetch: ${tasks.length}`);
  return tasks;
}


async function getWeatherData() {
  const data = await weatherBackend.getWeatherData();
  return data;
}


app.use(express.static(__dirname));

app.get('/metrics.json', (req, res) => {
  res.json(snapshot());
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid, uptime_s: Math.floor(process.uptime()) });
});

app.get('/ready', (req, res) => {
  const details = {
    process: true,
    env: {
      TRACCAR_URL: !!TRACCAR_URL,
      TRACCAR_USER: !!USER,
      TRACCAR_PASS: !!PASS,
      SPLYNX_URL: !!SPLYNX_URL,
      SPLYNX_KEYS: !!(SPLYNX_READ_ONLY_KEY && SPLYNX_SECRET),
      SPLYNX_ADMIN: !!(SPLYNX_ADMIN_USER && SPLYNX_ADMIN_PASS),
      NAGIOS_URL: !!NAGIOS_URL,
      NAGIOS_USER: !!NAGIOS_USER,
      NAGIOS_PASS: !!NAGIOS_PASS,
      OPENWEATHER_API_KEY: !!OPENWEATHER_API_KEY,
      ADMIN_TOKEN: !!ADMIN_TOKEN,
    },
    features: {
      traccar_enabled: ENABLE_TRACCAR,
      splynx_tasks_enabled: ENABLE_SPLYNX_TASKS,
      nagios_enabled: ENABLE_NAGIOS,
      weather_enabled: ENABLE_WEATHER,
    },
    missing: [],
    warnings: [],
  };

  if (ENABLE_TRACCAR) {
    if (!USER) details.missing.push('TRACCAR_USER');
    if (!PASS) details.missing.push('TRACCAR_PASS');
  }
  if (ENABLE_SPLYNX_TASKS) {
    if (!SPLYNX_READ_ONLY_KEY) details.missing.push('SPLYNX_READ_ONLY_KEY');
    if (!SPLYNX_SECRET) details.missing.push('SPLYNX_SECRET');
    if (!SPLYNX_ASSIGN_KEY) details.missing.push('SPLYNX_ASSIGN_KEY');
    if (!SPLYNX_ADMIN_USER || !SPLYNX_ADMIN_PASS) details.missing.push('SPLYNX_ADMIN_CREDS');
  }
  if (ENABLE_NAGIOS) {
    if (!NAGIOS_USER) details.missing.push('NAGIOS_USER');
    if (!NAGIOS_PASS) details.missing.push('NAGIOS_PASS');
  }
  if (ENABLE_WEATHER) {
    if (!OPENWEATHER_API_KEY) details.missing.push('OPENWEATHER_API_KEY');
  }
  if (!ADMIN_TOKEN) details.warnings.push('ADMIN_TOKEN not set (admin-only routes will be disabled)');

  const ok = details.missing.length === 0;
  res.status(ok ? 200 : 503).json({ ready: ok, details });
});

// ADDED: Serve public configuration to frontend
app.get("/api/config", (req, res) => {
  console.log('[API][CONFIG] Serving configuration to frontend');
  res.json({
    googleMapsKey: GOOGLE_MAPS_KEY,
    openWeatherKey: OPENWEATHER_API_KEY,
    adminToken: ADMIN_TOKEN,
    enableNagios: ENABLE_NAGIOS,
    enableSplynx: ENABLE_SPLYNX_TASKS,
    enableTraccar: ENABLE_TRACCAR,
    enableWeather: ENABLE_WEATHER,
    features: {
      weather: !!OPENWEATHER_API_KEY
    }
  });
});

app.post("/api/nagios/toggle", adminAuth, (req, res) => {
    const { enabled } = req.body;
    ENABLE_NAGIOS = enabled;
    nagiosService.setEnabled(ENABLE_NAGIOS);
    console.log(`[Nagios] Fetching ${ENABLE_NAGIOS ? 'ENABLED' : 'DISABLED'} via API`);
    res.json({ success: true, enabled: ENABLE_NAGIOS });
});

app.post("/api/splynx/toggle", adminAuth, (req, res) => {
  const { enabled } = req.body;
  ENABLE_SPLYNX_TASKS = !!enabled;
  splynxService.setEnabled(ENABLE_SPLYNX_TASKS);
  console.log(`[Splynx] Tasks integration ${ENABLE_SPLYNX_TASKS ? 'ENABLED' : 'DISABLED'} via API`);
  res.json({ success: true, enabled: ENABLE_SPLYNX_TASKS });
});

app.post("/api/tracker/toggle", adminAuth, (req, res) => {
  const { enabled } = req.body;
  ENABLE_TRACCAR = !!enabled;
  trackerService.setEnabled(ENABLE_TRACCAR);
  console.log(`[Tracker] Traccar integration ${ENABLE_TRACCAR ? 'ENABLED' : 'DISABLED'} via API`);
  res.json({ success: true, enabled: ENABLE_TRACCAR });
});

app.post("/api/weather/toggle", adminAuth, (req, res) => {
  const { enabled } = req.body;
  ENABLE_WEATHER = !!enabled;
  weatherBackend.setEnabled(ENABLE_WEATHER);
  console.log(`[Weather] Weather fetching ${ENABLE_WEATHER ? 'ENABLED' : 'DISABLED'} via API`);
  res.json({ success: true, enabled: ENABLE_WEATHER });
});

app.post("/api/simulation/report", (req, res) => {
    const report = req.body;
    console.log('[Simulation] Received report:', report.summary);
    
    const reportsDir = path.join(__dirname, "Data", "reports");
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const filename = `sim-report-${Date.now()}.json`;
    fs.writeFileSync(path.join(reportsDir, filename), JSON.stringify(report, null, 2));
    
    res.json({ success: true, filename });
});

app.get('/api/data/files', (req, res) => {
  try {
    const files = listSpreadsheetFiles(__dirname);
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.post('/api/tasks/import', express.json(), (req, res) => {
  try {
    const file = (req.body && req.body.file) ? String(req.body.file) : '';
    if (!file) return res.status(400).json({ error: 'Missing file parameter' });
    const allowed = /\.(xlsx|csv)$/i.test(file);
    if (!allowed) return res.status(400).json({ error: 'Unsupported file type' });
    const tasks = parseSplynxTasksFromFile(__dirname, file);
    tasksCache.set('all', tasks);
    tasksSourceFile = file;
    res.json({ ok: true, count: tasks.length, file });
  } catch (e) {
    if (/Missing required header/i.test(e.message)) {
      return res.status(422).json({ error: 'Invalid Splynx task export format', details: e.message });
    }
    if (/File not found/i.test(e.message)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Import failed', details: e.message });
  }
});

app.get('/api/tasks/reload', (req, res) => {
  try {
    if (tasksSourceFile && fs.existsSync(path.join(__dirname, 'Data', tasksSourceFile))) {
      const tasks = parseSplynxTasksFromFile(__dirname, tasksSourceFile);
      tasksCache.set('all', tasks);
      return res.json({ ok: true, count: tasks.length, file: tasksSourceFile });
    }
    const tmp = { data: tasksCache.peek('all') || null, lastFetch: tasksCache.ts('all') || 0, sourceFile: tasksSourceFile };
    const ok = tryAutoLoadSpreadsheetIntoCache(__dirname, tmp);
    if (ok) {
      tasksCache.set('all', tmp.data);
      tasksSourceFile = tmp.sourceFile;
      return res.json({ ok: true, count: tmp.data.length, file: tasksSourceFile });
    }
    res.status(404).json({ error: 'No spreadsheet found' });
  } catch (e) {
    res.status(500).json({ error: 'Reload failed', details: e.message });
  }
});

app.get("/api/positions", async (req, res) => {
  try {
    const positions = await trackerService.fetchPositions();
    if (!positions) return res.json([]);
    res.json(positions);
  } catch (error) {
    console.error("[API][TRACCAR][FATAL] Fetch failed:", error);
    res.status(500).json({ error: "Traccar fetch failed", details: error.message });
  }
});

app.get("/api/devices", async (req, res) => {
  try {
    const devices = await trackerService.fetchDevices();
    if (!devices) return res.json([]);
    res.json(devices);
  } catch (error) {
    console.error("Traccar fetch failed:", error.message);
    res.status(500).json({ error: "Traccar fetch failed", details: error.message });
  }
});

// ADDED: Fetch administrators from Splynx
app.get("/api/administrators", adminAuth, async (req, res) => {
  try {
    const administrators = await splynxService.fetchAdministrators();
    res.json(administrators);
  } catch (error) {
    console.error(`[API][SPLY][FATAL] Fetch failed:`, error);
    res.json([
      { id: 1, name: "Admin 1 (Mock-Fatal)" },
      { id: 2, name: "Admin 2 (Mock-Fatal)" },
      { id: 3, name: "Technician A (Mock-Fatal)" }
    ]);
  }
});

// ADDED: Fetch tasks (spreadsheet-first, API as optional fallback)
app.get("/api/tasks", async (req, res) => {
  try {
    const cached = tasksCache.get('all');
    if (cached) {
      return res.json(cached);
    }

    const tmp = { data: tasksCache.peek('all') || null, lastFetch: tasksCache.ts('all') || 0, sourceFile: tasksSourceFile };
    if (tryAutoLoadSpreadsheetIntoCache(__dirname, tmp)) {
      tasksCache.set('all', tmp.data);
      tasksSourceFile = tmp.sourceFile;
      return res.json(tmp.data || []);
    }

    // If Splynx integration is disabled, attempt to use local fallback file `Data/tasks.json`
    const localTasksFile = path.join(__dirname, "Data", "tasks.json");
    if (!ENABLE_SPLYNX_TASKS) {
      if (fs.existsSync(localTasksFile)) {
        try {
          const raw = fs.readFileSync(localTasksFile, 'utf8');
          const local = JSON.parse(raw);
          const arr = Array.isArray(local) ? local : [];
          tasksCache.set('all', arr);
          tasksSourceFile = 'tasks.json (local)';
          console.log(`[Tasks] Loaded ${arr.length} tasks from local fallback ${localTasksFile}`);
          return res.json(arr);
        } catch (e) {
          console.error('[Tasks] Failed to load local tasks.json fallback:', e && e.message);
          // fall through to return cache/empty
        }
      }
      const cached = tasksCache.peek('all');
      return res.json(cached || []);
    }

    const newTasks = await fetchTasksFromSplynx();
    const prev = tasksCache.peek('all') || [];
    let merged = [];
    if (!prev || prev.length === 0) {
      merged = newTasks;
    } else {
      const taskMap = new Map(prev.map(t => [String(t.ID || t.id), t]));
      newTasks.forEach(t => {
        taskMap.set(String(t.ID || t.id), t);
      });
      merged = Array.from(taskMap.values());
    }

    tasksCache.set('all', merged);
    res.json(merged);
  } catch (error) {
    const cached = tasksCache.peek('all');
    if (cached) return res.json(cached);
    const tasksFile = path.join(__dirname, "Data", "tasks.json");
    if (fs.existsSync(tasksFile)) {
      try {
        const data = fs.readFileSync(tasksFile, 'utf8');
        return res.json(JSON.parse(data));
      } catch(e) {}
    }
    res.json([]);
  }
});


app.get("/api/weather", async (req, res) => {
  try {
    const weatherData = await getWeatherData();
    
    if (!weatherData) {
      inc('cache_miss', { cache: 'weather' });
      if (!OPENWEATHER_API_KEY) {
        return res.status(503).json({ 
          error: "Weather service not configured",
          message: "OpenWeatherMap API key is missing"
        });
      }
      return res.status(503).json({ 
        error: "Weather data unavailable",
        message: "Failed to fetch weather data"
      });
    }
    
    inc('cache_hit', { cache: 'weather' });
    res.json(weatherData);
  } catch (error) {
    console.error("[Weather][API] Failed to serve weather data:", error.message);
    res.status(500).json({ 
      error: "Weather fetch failed", 
      details: error.message 
    });
  }
});

app.get('/api/onecall', async (req, res) => {
  try{
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Missing lat/lon' });
    const data = await weatherBackend.oneCall(lat, lon);
    res.json(data);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: 'Failed to fetch onecall' });
  }
});

// ADDED: Get current API call statistics
app.get('/api/weather/stats', (req, res) => {
  res.json(weatherBackend.weatherStats());
});

app.post('/api/weather/stats/limit', express.json(), (req, res) => {
  const { limit } = req.body;
  const stats = weatherBackend.setLimit(limit);
  res.json(stats);
});

app.post('/api/weather/stats/reset', (req, res) => {
  const stats = weatherBackend.resetCounter();
  res.json(stats);
});

// ADDED: Assign tasks to a technician and add a comment
app.post("/api/tasks/assign", adminAuth, express.json(), async (req, res) => {
  console.log('[API][ASSIGN][START] Request received for assignment');
  try {
    const { taskIds, technicianId, technicianName } = req.body;
    if (!taskIds || !technicianId) {
      console.warn('[API][ASSIGN][WARN] Missing required fields in body:', req.body);
      return res.status(400).json({ error: "Missing taskIds or technicianId" });
    }

    console.log(`[API][ASSIGN][PROCESS] Assigning ${taskIds.length} tasks to ${technicianName} (ID: ${technicianId})`);
    const results = [];

    for (const taskId of taskIds) {
      const r = await splynxService.assignTask(taskId, technicianId, technicianName);
      results.push(r);
    }

    console.log('[API][ASSIGN][DONE] All tasks processed');
    res.json({ results });
  } catch (error) {
    console.error("[API][ASSIGN][FATAL] Task assignment failed:", error);
    res.status(500).json({ error: "Task assignment failed", details: error.message });
  }
});

// ADDED: Fetch Nagios service status for a specific host
app.get("/api/nagios/toggle", (req, res) => {
  const enabled = req.query.enabled === 'true';
  ENABLE_NAGIOS = enabled;
  console.log(`Nagios fetching ${ENABLE_NAGIOS ? 'ENABLED' : 'DISABLED'} via API`);
  res.json({ enabled: ENABLE_NAGIOS });
});

app.get("/api/nagios/status/:hostName", async (req, res) => {
  try {
    const hostName = req.params.hostName;
    const now = Date.now();

    const cachedAll = nagiosCache.get('all');
    if (cachedAll) {
      const filteredServices = cachedAll.filter(s => s.host_name === hostName);
      if (filteredServices.length > 0) {
        return res.json({
          hostName,
          services: filteredServices,
          timestamp: new Date(nagiosCache.ts('all') || Date.now()).toISOString()
        });
      }
    }

    const [services, hosts] = await Promise.all([
      nagiosService.fetchFromNagios(hostName, 'services'),
      nagiosService.fetchFromNagios(hostName, 'hosts')
    ]);
    const filteredHosts = hosts.filter(h => h.host_name === hostName);
    const allStatus = [...services, ...filteredHosts];

    const status = {
      hostName,
      services: allStatus,
      timestamp: new Date().toISOString()
    };

    res.json(status);
  } catch (error) {
    console.error("Nagios fetch failed:", error.message);
    res.status(500).json({ error: "Nagios fetch failed", details: error.message });
  }
});

// ADDED: Fetch Nagios status for all services and broadcast to all connected WebSocket clients
async function broadcastNagiosStatus() {
  if (wss.clients.size === 0) return;

  try {
    const now = Date.now();
    let allStatus;

    const cached = nagiosCache.get('all');
    if (cached) {
      allStatus = cached;
    } else if (!ENABLE_NAGIOS) {
      const peeked = nagiosCache.peek('all');
      if (peeked) allStatus = peeked;
      else return;
    } else {
      allStatus = await nagiosService.getAllStatus(true);
      nagiosCache.set('all', allStatus);
      console.log(`[Nagios] Fetched and cached ${allStatus.length} entries`);
    }

    const message = JSON.stringify({
      type: "nagios_update",
      services: allStatus,
      timestamp: new Date().toISOString()
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    inc('ws_broadcast_total', { type: 'nagios' });
    const uniqueHosts = [...new Set(allStatus.map(s => s.host_name))];
    console.log(`[Nagios] Broadcast ${allStatus.length} entries across ${uniqueHosts.length} hosts to ${wss.clients.size} clients`);
  } catch (error) {
    console.error("Error broadcasting Nagios status:", error.message);
  }
}

// ADDED: Fetch tracker positions and broadcast to all connected WebSocket clients
async function broadcastTrackerPositions() {
  if (wss.clients.size === 0 || !ENABLE_TRACCAR) return;

  try {
    const positions = await trackerService.fetchPositions();
    if (!positions) return;

    const message = JSON.stringify({
      type: "tracker_update",
      positions: positions,
      timestamp: new Date().toISOString()
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    inc('ws_broadcast_total', { type: 'tracker' });
    console.log(`[WebSocket] Broadcast ${positions.length} tracker positions to ${wss.clients.size} clients`);
  } catch (error) {
    console.error("Error broadcasting tracker positions:", error.message);
  }
}

// ADDED: Fetch tasks and broadcast to all connected WebSocket clients
async function broadcastTasks() {
  if (wss.clients.size === 0) return;

  try {
    let tasks = tasksCache.get('all');

    if (!tasks) {
      const tmp = { data: tasksCache.peek('all') || null, lastFetch: tasksCache.ts('all') || 0, sourceFile: tasksSourceFile };
      if (tryAutoLoadSpreadsheetIntoCache(__dirname, tmp)) {
        tasksCache.set('all', tmp.data);
        tasksSourceFile = tmp.sourceFile;
        tasks = tmp.data;
      } else if (ENABLE_SPLYNX_TASKS) {
        try {
          const fetchedTasks = await fetchTasksFromSplynx();
          const prev = tasksCache.peek('all') || [];
          if (!prev || prev.length === 0) {
            tasks = fetchedTasks;
          } else {
            const taskMap = new Map(prev.map(t => [String(t.id || t.ID), t]));
            fetchedTasks.forEach(t => {
              taskMap.set(String(t.id || t.ID), t);
            });
            tasks = Array.from(taskMap.values());
          }
          tasksCache.set('all', tasks);
        } catch (e) {
          const cached = tasksCache.peek('all');
          if (cached) tasks = cached; else return;
        }
      } else {
        const cached = tasksCache.peek('all');
        if (cached) tasks = cached; else return;
      }
    }

    const message = JSON.stringify({
      type: "tasks_update",
      tasks: tasks,
      timestamp: new Date().toISOString()
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    inc('ws_broadcast_total', { type: 'tasks' });
    console.log(`[WebSocket] Broadcast ${tasks.length} tasks to ${wss.clients.size} clients`);
  } catch (error) {
    console.error("Error broadcasting tasks:", error.message);
  }
}

// ADDED: Fetch lightning strikes and broadcast to all connected WebSocket clients
async function broadcastWeatherEvents() {
  if (wss.clients.size === 0) return;

  try {
    // NOTE: Real-time lightning APIs are often paid or require registration.
    // For now, we implement a fetcher that can be pointed to Blitzortung or OpenWeatherMap.
    // As a fallback, we can simulate strikes for testing when no key is provided.
    
    let strikes = [];
    
    if (OPENWEATHER_API_KEY) {
      // Example implementation for OpenWeatherMap (requires specific subscription)
      // url = `https://api.openweathermap.org/data/2.5/lightning?lat=-25.0&lon=28.0&appid=${OPENWEATHER_API_KEY}`;
      // For now, we'll simulate some data to show the frontend implementation works
    }

    // SIMULATION: If no real data source is configured, generate a random strike near the office
    // This allows the user to see the feature in action immediately.
    if (strikes.length === 0) {
      // 20% chance of a strike occurring in each check cycle
      if (Math.random() > 0.8) {
        strikes.push({
          id: `strike_${Date.now()}`,
          lat: -25.7479 + (Math.random() - 0.5) * 0.5, // Around Pretoria/Midrand
          lng: 28.2293 + (Math.random() - 0.5) * 0.5,
          intensity: Math.floor(Math.random() * 100),
          timestamp: new Date().toISOString()
        });
      }
    }

    if (strikes.length > 0) {
      const message = JSON.stringify({
        type: "weather_update",
        strikes: strikes,
        timestamp: new Date().toISOString()
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

      inc('ws_broadcast_total', { type: 'weather' });
      console.log(`[Weather] Broadcast ${strikes.length} lightning strikes to ${wss.clients.size} clients`);
    }
  } catch (error) {
    console.error("Error broadcasting weather events:", error.message);
  }
}

// ADDED: WebSocket connection handler
wss.on("connection", (ws) => {
  console.log(`[WebSocket] Client connected. Total clients: ${wss.clients.size}`);

  // Start broadcasts if this is the first client
  if (wss.clients.size === 1) {
    console.log("[WebSocket] First client connected, starting broadcast timers");
    startTrackerBroadcast();
    startNagiosBroadcast();
    startTasksBroadcast();
    startWeatherBroadcast();
  }

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error.message);
    }
  });

  ws.on("close", () => {
    console.log(`[WebSocket] Client disconnected. Total clients: ${wss.clients.size}`);
    
    // Stop broadcasts if this was the last client
    if (wss.clients.size === 0) {
      console.log("[WebSocket] No clients connected, stopping broadcast timers");
      stopAllBroadcasts();
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });

  ws.send(JSON.stringify({
    type: "welcome",
    message: "Connected to Belanet Tracker Server",
    timestamp: new Date().toISOString()
  }));

  // Send initial data from cache if available
  const initNagios = nagiosCache.peek('all');
  if (initNagios) {
    ws.send(JSON.stringify({
      type: "nagios_update",
      services: initNagios,
      timestamp: new Date(nagiosCache.ts('all') || Date.now()).toISOString()
    }));
  }
  const initTasks = tasksCache.peek('all');
  if (initTasks) {
    ws.send(JSON.stringify({
      type: "tasks_update",
      tasks: initTasks,
      timestamp: new Date(tasksCache.ts('all') || Date.now()).toISOString()
    }));
  }
  if (trackerCache.data) {
    ws.send(JSON.stringify({
      type: "tracker_update",
      positions: trackerCache.data,
      timestamp: new Date(trackerCache.lastFetch).toISOString()
    }));
  }
});

// ADDED: Stop all broadcast timers
function stopAllBroadcasts() {
  if (trackerBroadcastTimer) {
    clearInterval(trackerBroadcastTimer);
    trackerBroadcastTimer = null;
  }
  if (nagioBroadcastTimer) {
    clearInterval(nagioBroadcastTimer);
    nagioBroadcastTimer = null;
  }
  if (tasksBroadcastTimer) {
    clearInterval(tasksBroadcastTimer);
    tasksBroadcastTimer = null;
  }
  if (weatherBroadcastTimer) {
    clearInterval(weatherBroadcastTimer);
    weatherBroadcastTimer = null;
  }
  console.log("[Broadcast] All timers stopped");
}

// ADDED: Start periodic weather broadcasts
let weatherBroadcastTimer;
function startWeatherBroadcast() {
  if (weatherBroadcastTimer) return;
  broadcastWeatherEvents();
  weatherBroadcastTimer = setInterval(broadcastWeatherEvents, WEATHER_REFRESH_INTERVAL);
  console.log(`[Weather Broadcast] Started with ${WEATHER_REFRESH_INTERVAL}ms interval`);
}

// ADDED: Start periodic tracker position broadcasts
let trackerBroadcastTimer;
function startTrackerBroadcast() {
  if (trackerBroadcastTimer) return;
  broadcastTrackerPositions();
  if (ENABLE_TRACCAR) {
    trackerBroadcastTimer = setInterval(broadcastTrackerPositions, TRACKER_REFRESH_INTERVAL);
    console.log(`[Tracker Broadcast] Started with ${TRACKER_REFRESH_INTERVAL}ms interval`);
  } else {
    console.log("[Tracker Broadcast] Periodic refresh disabled via ENABLE_TRACCAR");
  }
}

// ADDED: Start periodic Nagios status broadcasts
let nagioBroadcastTimer;
function startNagiosBroadcast() {
  if (nagioBroadcastTimer) return;
  broadcastNagiosStatus();
  nagioBroadcastTimer = setInterval(broadcastNagiosStatus, NAGIOS_REFRESH_INTERVAL);
  console.log(`[Nagios Broadcast] Started with ${NAGIOS_REFRESH_INTERVAL}ms interval`);
}

// ADDED: Start periodic tasks broadcasts
let tasksBroadcastTimer;
function startTasksBroadcast() {
  if (tasksBroadcastTimer) return;
  broadcastTasks();
  if (ENABLE_SPLYNX_TASKS) {
    tasksBroadcastTimer = setInterval(broadcastTasks, TASKS_REFRESH_INTERVAL);
    console.log(`[Tasks Broadcast] Started with ${TASKS_REFRESH_INTERVAL}ms interval`);
  } else {
    console.log("[Tasks Broadcast] Periodic refresh disabled via ENABLE_SPLYNX_TASKS");
  }
}

// ADDED: Handle server shutdown gracefully
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, closing...");
  stopAllBroadcasts();
  wss.clients.forEach((client) => client.close());
  server.close(() => {
    console.log("[Server] Closed");
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}`);
  console.log(`[WebSocket] WSS endpoint at ws://localhost:${PORT}`);
  // Timers will start when the first client connects
});

