require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const XLSX = require('xlsx');
const http = require("http");
const https = require("https");
const cheerio = require("cheerio");
const { chromium } = require('playwright');
const axios = require('axios');

const { logger, requestLoggerMiddleware, installConsoleInterceptor } = require('./lib/logger');
const { requestMetricsMiddleware, inc, setGauge, snapshot } = require('./lib/metrics');
installConsoleInterceptor();
const app = express();
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(requestMetricsMiddleware);
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 5505;
const DATA_DIR = path.join(__dirname, "Data", "icons");

const { TrackerService } = require('./services/TrackerService');
const { NagiosService } = require('./services/NagiosService');
const { SplynxService } = require('./services/SplynxService');
const { WeatherBackend } = require('./services/WeatherBackend');

const TRACCAR_URL = process.env.TRACCAR_URL || "https://demo.traccar.org";
const USER = process.env.TRACCAR_USER || "";
const PASS = process.env.TRACCAR_PASS || "";
const ENABLE_TRACCAR = process.env.ENABLE_TRACCAR === 'true';

const SPLYNX_URL = process.env.SPLYNX_URL || "https://splynx.bndns.co.za";
const SPLYNX_READ_ONLY_KEY = process.env.SPLYNX_READ_ONLY_KEY || process.env.SPLYNX_KEY || "";
const SPLYNX_ASSIGN_KEY = process.env.SPLYNX_ASSIGN_KEY || process.env.SPLYNX_KEY || "";
const SPLYNX_SECRET = process.env.SPLYNX_SECRET || "";
const ENABLE_SPLYNX_TASKS = process.env.ENABLE_SPLYNX_TASKS === 'true';

const NAGIOS_URL = process.env.NAGIOS_URL || "http://nagios.bndns.co.za/nagios";
const NAGIOS_USER = process.env.NAGIOS_USER || "nagiosadmin";
const NAGIOS_PASS = process.env.NAGIOS_PASS || "";
let ENABLE_NAGIOS = true;

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY || "";
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const SPLYNX_ADMIN_USER = process.env.SPLYNX_ADMIN_USER || "Jason";
const SPLYNX_ADMIN_PASS = process.env.SPLYNX_ADMIN_PASS || "";

const TRACKER_REFRESH_INTERVAL = 5000;
const NAGIOS_REFRESH_INTERVAL = 60000; // Increased from 30s to 1m
const TASKS_REFRESH_INTERVAL = 900000; // 15 minutes as requested
const WEATHER_REFRESH_INTERVAL = 30000; // 30 seconds for lightning/weather

const trackerService = new TrackerService({ baseUrl: TRACCAR_URL, user: USER, pass: PASS, enable: ENABLE_TRACCAR, dataDir: path.join(__dirname, 'Data', 'icons') });
const nagiosService = new NagiosService({ baseUrl: NAGIOS_URL, user: NAGIOS_USER, pass: NAGIOS_PASS, enable: true, refreshMs: NAGIOS_REFRESH_INTERVAL });
const splynxService = new SplynxService({ baseUrl: SPLYNX_URL, readKey: SPLYNX_READ_ONLY_KEY, assignKey: SPLYNX_ASSIGN_KEY, secret: SPLYNX_SECRET, adminUser: SPLYNX_ADMIN_USER, adminPass: SPLYNX_ADMIN_PASS });
const weatherBackend = new WeatherBackend({ apiKey: OPENWEATHER_API_KEY, dataDir: __dirname });

let nagiosStatusCache = {
  data: null,
  lastFetch: 0
};

let tasksCache = {
  data: null,
  lastFetch: 0,
  sourceFile: null
};

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

let splynxSessionCache = {
  cookie: null,
  lastLogin: 0
};

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

// ADDED: Session helper for UI interactions
async function getSplynxSession() {
  const now = Date.now();
  // Reuse session if it's less than 30 minutes old
  if (splynxSessionCache.cookie && (now - splynxSessionCache.lastLogin < 1800000)) {
      console.log('[LOGIN][CACHE] Using cached Splynx session');
      return splynxSessionCache.cookie;
  }

  console.log(`[LOGIN][AUTH] Starting Playwright authentication for ${SPLYNX_URL}`);
  let browser;
  try {
      browser = await chromium.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      const context = await browser.newContext();
      const page = await context.newPage();

      const loginUrl = `${SPLYNX_URL}/admin/login/`;
      console.log(`[LOGIN][NAVIGATE] Going to ${loginUrl}`);
      await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 60000 });

      if (page.url().includes('/admin/dashboard')) {
          console.log('[LOGIN][SUCCESS] Already logged in via session persistence');
      } else {
          console.log('[LOGIN][FLOW] Filling credentials for user:', SPLYNX_ADMIN_USER);
          await page.waitForSelector('input[name="LoginForm[login]"]', { timeout: 10000 });
          await page.fill('input[name="LoginForm[login]"]', SPLYNX_ADMIN_USER);
          await page.fill('input[name="LoginForm[password]"]', SPLYNX_ADMIN_PASS);
          
          console.log('[LOGIN][FLOW] Clicking submit');
          await page.click('#submit');
          
          try {
              await page.waitForURL('**/admin/dashboard', { timeout: 30000 });
              console.log('[LOGIN][SUCCESS] Login successful, reached dashboard');
          } catch (urlErr) {
              const currentUrl = page.url();
              const pageContent = await page.content();
              console.error(`[LOGIN][ERROR] Failed to reach dashboard. Current URL: ${currentUrl}`);
              if (pageContent.includes('Incorrect username or password')) {
                  console.error('[LOGIN][ERROR] Authentication Failure: Incorrect username or password');
              }
              throw new Error(`Login failed to reach dashboard. URL: ${currentUrl}`);
          }
      }

      const cookies = await context.cookies();
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      if (!cookieStr) {
          throw new Error('No cookies retrieved after login');
      }

      // Cache the result
      splynxSessionCache.cookie = cookieStr;
      splynxSessionCache.lastLogin = Date.now();
      
      console.log('[LOGIN][SESSION] Session cookies captured and cached');
      return cookieStr;
  } catch (err) {
      console.error('[LOGIN][FATAL] Playwright FAILED:', err);
      return null;
  } finally {
      if (browser) {
          await browser.close();
          console.log('[LOGIN][CLEANUP] Browser closed');
      }
  }
}

// ADDED: Helper to add a comment to a task using session cookies
async function addSplynxComment(taskId, technicianName) {
    console.log(`[COMMENT][START] Adding assignment comment for task ${taskId}`);
    const cookieStr = await getSplynxSession();
    if (!cookieStr) {
        console.error('[COMMENT][ERROR] Failed to get session for comment - aborting');
        return false;
    }

    try {
        // 1. Get the task view page to extract CSRF token
        const taskUrl = `${SPLYNX_URL}/admin/scheduling/tasks/view?id=${taskId}`;
        console.log(`[COMMENT][CSRF] Fetching task page to extract CSRF: ${taskUrl}`);
        const viewRes = await axios.get(taskUrl, {
            headers: { 'Cookie': cookieStr },
            timeout: 10000
        });

        const $ = cheerio.load(viewRes.data);
        const csrfToken = $('meta[name="csrf-token"]').attr('content');

        if (!csrfToken) {
            console.error('[COMMENT][ERROR] CSRF token not found in page content');
            // Log a snippet of the page for debugging if needed
            return false;
        }
        console.log('[COMMENT][CSRF] CSRF token successfully extracted');

        // 2. POST the comment
        const commentUrl = `${SPLYNX_URL}/admin/scheduling/tasks/view--save-comment?id=${taskId}`;
        const formData = new URLSearchParams();
        formData.append('_csrf_token', csrfToken);
        formData.append('TaskComment[text]', `This task has been assigned to ${technicianName} - Auto`);

        console.log(`[COMMENT][POST] Sending comment to: ${commentUrl}`);
        const saveRes = await axios.post(commentUrl, formData.toString(), {
            headers: {
                'Cookie': cookieStr,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 10000
        });

        console.log(`[COMMENT][SUCCESS] Task ${taskId} comment result:`, saveRes.data.result || 'success');
        return true;
    } catch (err) {
        console.error(`[COMMENT][ERROR] Failed to add comment for task ${taskId}:`, err.response ? {
            status: err.response.status,
            data: err.response.data
        } : err.message);
        return false;
    }
}

// ADDED: Read task IDs from Excel export to filter API requests
function loadTaskIdsFromExcel() {
  console.log("[Excel] Attempting to load task IDs from Belanet Tasks Export.xlsx...");
  try {
    const filePath = path.join(__dirname, 'Data', 'Belanet Tasks Export.xlsx');
    if (!fs.existsSync(filePath)) {
      console.warn('[Excel] ⚠ Export file not found at:', filePath);
      return [];
    }
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const taskIds = data.slice(2)
      .map(row => row[1])
      .filter(id => id && !isNaN(id));
    console.log(`[Excel] ✅ Successfully loaded ${taskIds.length} task IDs from file`);
    if (taskIds.length > 0) {
      console.log(`[Excel] Sample IDs: ${taskIds.slice(0, 5).join(', ')}...`);
    }
    return taskIds;
  } catch (error) {
    console.error('[Excel] ❌ Error reading task IDs:', error.message);
    return [];
  }
}

function listSpreadsheetFiles() {
  const dir = path.join(__dirname, 'Data');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => /\.(xlsx|csv)$/i.test(f));
  return files.sort();
}

function parseSplynxTasksFromFile(filePath) {
  const full = path.isAbsolute(filePath) ? filePath : path.join(__dirname, 'Data', filePath);
  if (!fs.existsSync(full)) throw new Error('File not found');
  const wb = XLSX.readFile(full);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  if (!rows || rows.length === 0) throw new Error('Empty spreadsheet');
  const header = rows[0].map(h => String(h || '').trim());
  const idx = {};
  header.forEach((h, i) => { idx[h.toLowerCase()] = i; });
  const need = ['id', 'title'];
  for (const k of need) { if (!(k in idx)) throw new Error('Missing required header: ' + k); }
  const tasks = [];
  const seen = new Set();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const id = row[idx['id']];
    const title = row[idx['title']];
    if (!id || !title) continue;
    const key = String(id).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const t = {
      ID: key,
      Title: String(title).trim()
    };
    if ('status' in idx) t.Status = String(row[idx['status']] || '').trim();
    if ('customer' in idx) t.Customer = String(row[idx['customer']] || '').trim();
    if ('created at' in idx) {
      const v = row[idx['created at']];
      if (v) t['Created at'] = new Date(v).toISOString();
    }
    if ('updated at' in idx) {
      const v2 = row[idx['updated at']];
      if (v2) t['Updated at'] = new Date(v2).toISOString();
    }
    tasks.push(t);
  }
  return tasks;
}

function tryAutoLoadSpreadsheetIntoCache() {
  if (tasksCache.data && tasksCache.data.length > 0) return false;
  const files = listSpreadsheetFiles();
  if (files.length === 0) return false;
  try {
    const tasks = parseSplynxTasksFromFile(files[0]);
    tasksCache.data = tasks;
    tasksCache.lastFetch = Date.now();
    tasksCache.sourceFile = files[0];
    console.log(`[Tasks] Loaded ${tasks.length} tasks from ${files[0]}`);
    return true;
  } catch (e) {
    console.error('[Tasks] Failed to auto-load spreadsheet:', e.message);
    return false;
  }
}

// ADDED: Helper to fetch tasks from Splynx with filtering
async function fetchTasksFromSplynx() {
  if (!ENABLE_SPLYNX_TASKS) {
    console.log("[Splynx] Task fetching is disabled via ENABLE_SPLYNX_TASKS");
    return [];
  }
  const auth = Buffer.from(`${SPLYNX_READ_ONLY_KEY}:${SPLYNX_SECRET}`).toString("base64");
  const allTaskIds = loadTaskIdsFromExcel();
  
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

// ADDED: Fetch Nagios status page and parse HTML
async function fetchFromNagios(hostName = null, type = 'services') {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${NAGIOS_USER}:${NAGIOS_PASS}`).toString('base64');
    
    let url;
    if (type === 'hosts') {
      url = `${NAGIOS_URL}/cgi-bin/status.cgi?hostgroup=all&style=hostdetail&limit=0`;
    } else {
      url = hostName 
        ? `${NAGIOS_URL}/cgi-bin/status.cgi?host=${encodeURIComponent(hostName)}&limit=0`
        : `${NAGIOS_URL}/cgi-bin/status.cgi?host=all&limit=0`;
    }

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Authorization': `Basic ${auth}`
      },
      timeout: 15000
    };

    http.get(options, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = type === 'hosts' ? parseNagiosHostHTML(html) : parseNagiosHTML(html);
            resolve(data);
          } catch (e) {
            reject(new Error(`Failed to parse HTML: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', reject).on('timeout', () => {
      reject(new Error('Request timeout'));
    });
  });
}

// ADDED: Parse Nagios HTML host status page
function parseNagiosHostHTML(html) {
  const $ = cheerio.load(html);
  const hosts = [];
  
  $('tr').each((rowIdx, row) => {
    const cells = $('td', row);
    if (cells.length < 3) return;
    
    const hostName = $(cells[0]).text().trim();
    const status = $(cells[1]).text().trim();
    const info = $(cells[ cells.length - 1 ]).text().trim();
    
    if (hostName && status && hostName !== 'Host' && status !== 'Status' && hostName.length < 100) {
      let stateCode = 0; // UP
      let stateText = 'UP';
      
      if (status.includes('DOWN')) {
        stateCode = 2; // DOWN
        stateText = 'DOWN';
      } else if (status.includes('UNREACHABLE')) {
        stateCode = 1; // UNREACHABLE
        stateText = 'UNREACHABLE';
      }
      
      hosts.push({
        host_name: hostName,
        service_name: 'Host Status',
        current_state: stateCode,
        current_state_text: stateText,
        plugin_output: info,
        last_check: new Date().toISOString(),
        is_host: true
      });
    }
  });
  
  return hosts;
}

// ADDED: Parse Nagios HTML status page to extract service data
function parseNagiosHTML(html) {
  const $ = cheerio.load(html);
  const services = [];
  let currentHost = '';
  
  // Parse the status table rows
  $('tr').each((rowIdx, row) => {
    const cells = $('td', row);
    if (cells.length < 3) return;
    
    let hostName = $(cells[0]).text().trim();
    const serviceName = $(cells[1]).text().trim();
    const status = $(cells[2]).text().trim();
    
    if (hostName) {
      currentHost = hostName;
    } else {
      hostName = currentHost;
    }
    
    if (hostName && serviceName && status && serviceName !== 'Service' && status !== 'Status' && hostName.length < 100) {
      // Filter out meta-rows like "All Problems", "Current Network Status"
      if (hostName.includes('Status') || serviceName.includes('Status') || hostName.includes('History')) return;

      let stateCode = 0;
      let stateText = 'OK';
      
      if (status.includes('CRITICAL')) {
        stateCode = 2;
        stateText = 'CRITICAL';
      } else if (status.includes('WARNING')) {
        stateCode = 1;
        stateText = 'WARNING';
      } else if (status.includes('UNKNOWN')) {
        stateCode = 3;
        stateText = 'UNKNOWN';
      }
      
      services.push({
        host_name: hostName,
        service_name: serviceName,
        current_state: stateCode,
        current_state_text: stateText,
        plugin_output: status,
        last_check: new Date().toISOString(),
        next_check: new Date().toISOString()
      });
    }
  });
  
  return services;
}

async function ensureUserIconFolder(username) {
  const userIconDir = path.join(DATA_DIR, username);
  if (!fs.existsSync(userIconDir)) {
    fs.mkdirSync(userIconDir, { recursive: true });
  }
}

app.use(express.static(__dirname));

app.get('/metrics.json', (req, res) => {
  res.json(snapshot());
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid, uptime_s: Math.floor(process.uptime()) });
});

app.get('/ready', (req, res) => {
  const readiness = {
    process: true,
    env: {
      TRACCAR_URL: !!TRACCAR_URL,
      TRACCAR_USER: !!USER,
      TRACCAR_PASS: !!PASS,
      SPLYNX_URL: !!SPLYNX_URL,
      SPLYNX_KEYS: !!(SPLYNX_READ_ONLY_KEY && SPLYNX_SECRET),
      NAGIOS_URL: !!NAGIOS_URL,
      NAGIOS_USER: !!NAGIOS_USER,
      NAGIOS_PASS: !!NAGIOS_PASS,
      OPENWEATHER_API_KEY: !!OPENWEATHER_API_KEY,
    },
    features: {
      traccar_enabled: ENABLE_TRACCAR,
      splynx_tasks_enabled: ENABLE_SPLYNX_TASKS,
      nagios_enabled: ENABLE_NAGIOS,
    }
  };
  let ok = true;
  if (ENABLE_TRACCAR && (!USER || !PASS)) ok = false;
  if (ENABLE_SPLYNX_TASKS && (!SPLYNX_READ_ONLY_KEY || !SPLYNX_SECRET)) ok = false;
  if (ENABLE_NAGIOS && (!NAGIOS_USER || !NAGIOS_PASS)) ok = false;
  res.status(ok ? 200 : 503).json({ ready: ok, details: readiness });
});

// ADDED: Serve public configuration to frontend
app.get("/api/config", (req, res) => {
  console.log('[API][CONFIG] Serving configuration to frontend');
  res.json({
    googleMapsKey: GOOGLE_MAPS_KEY,
    openWeatherKey: OPENWEATHER_API_KEY,
    adminToken: ADMIN_TOKEN,
    enableNagios: ENABLE_NAGIOS,
    features: {
      weather: !!OPENWEATHER_API_KEY
    }
  });
});

app.post("/api/nagios/toggle", adminAuth, (req, res) => {
    const { enabled } = req.body;
    ENABLE_NAGIOS = enabled;
    console.log(`[Nagios] Fetching ${ENABLE_NAGIOS ? 'ENABLED' : 'DISABLED'} via API`);
    res.json({ success: true, enabled: ENABLE_NAGIOS });
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
    const files = listSpreadsheetFiles();
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
    const tasks = parseSplynxTasksFromFile(file);
    tasksCache.data = tasks;
    tasksCache.lastFetch = Date.now();
    tasksCache.sourceFile = file;
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
    if (tasksCache.sourceFile && fs.existsSync(path.join(__dirname, 'Data', tasksCache.sourceFile))) {
      const tasks = parseSplynxTasksFromFile(tasksCache.sourceFile);
      tasksCache.data = tasks;
      tasksCache.lastFetch = Date.now();
      return res.json({ ok: true, count: tasks.length, file: tasksCache.sourceFile });
    }
    const ok = tryAutoLoadSpreadsheetIntoCache();
    if (ok) return res.json({ ok: true, count: tasksCache.data.length, file: tasksCache.sourceFile });
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
    const now = Date.now();
    if (tasksCache.data && (now - tasksCache.lastFetch < TASKS_REFRESH_INTERVAL)) {
      inc('cache_hit', { cache: 'splynx_tasks' });
      return res.json(tasksCache.data);
    }

    if (tryAutoLoadSpreadsheetIntoCache()) {
      return res.json(tasksCache.data || []);
    }

    // If Splynx integration is disabled, attempt to use local fallback file `Data/tasks.json`
    const localTasksFile = path.join(__dirname, "Data", "tasks.json");
    if (!ENABLE_SPLYNX_TASKS) {
      if (fs.existsSync(localTasksFile)) {
        try {
          const raw = fs.readFileSync(localTasksFile, 'utf8');
          const local = JSON.parse(raw);
          tasksCache.data = Array.isArray(local) ? local : [];
          tasksCache.lastFetch = now;
          tasksCache.sourceFile = 'tasks.json (local)';
          console.log(`[Tasks] Loaded ${tasksCache.data.length} tasks from local fallback ${localTasksFile}`);
          return res.json(tasksCache.data);
        } catch (e) {
          console.error('[Tasks] Failed to load local tasks.json fallback:', e && e.message);
          // fall through to return cache/empty
        }
      }
      return res.json(tasksCache.data || []);
    }

    const newTasks = await fetchTasksFromSplynx();
    if (!tasksCache.data || tasksCache.data.length === 0) {
      tasksCache.data = newTasks;
    } else {
      const taskMap = new Map(tasksCache.data.map(t => [String(t.ID || t.id), t]));
      newTasks.forEach(t => {
        taskMap.set(String(t.ID || t.id), t);
      });
      tasksCache.data = Array.from(taskMap.values());
    }

    tasksCache.lastFetch = now;
    res.json(tasksCache.data);
  } catch (error) {
    if (tasksCache.data) return res.json(tasksCache.data);
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

    if (nagiosStatusCache.data && (now - nagiosStatusCache.lastFetch < NAGIOS_REFRESH_INTERVAL)) {
      const filteredServices = nagiosStatusCache.data.filter(s => s.host_name === hostName);
      if (filteredServices.length > 0) {
        console.log(`[Nagios] Serving status for ${hostName} from global cache`);
        return res.json({
          hostName,
          services: filteredServices,
          timestamp: new Date(nagiosStatusCache.lastFetch).toISOString()
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

    if (nagiosStatusCache.data && (now - nagiosStatusCache.lastFetch < NAGIOS_REFRESH_INTERVAL)) {
      allStatus = nagiosStatusCache.data;
    } else if (!ENABLE_NAGIOS) {
      if (nagiosStatusCache.data) allStatus = nagiosStatusCache.data;
      else return;
    } else {
      allStatus = await nagiosService.getAllStatus(true);
      nagiosStatusCache.data = allStatus;
      nagiosStatusCache.lastFetch = now;
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
    const now = Date.now();
    let tasks;

    if (tasksCache.data && (now - tasksCache.lastFetch < TASKS_REFRESH_INTERVAL)) {
      tasks = tasksCache.data;
    } else if (tryAutoLoadSpreadsheetIntoCache()) {
      tasks = tasksCache.data;
    } else if (ENABLE_SPLYNX_TASKS) {
      try {
        const fetchedTasks = await fetchTasksFromSplynx();
        if (!tasksCache.data || tasksCache.data.length === 0) {
          tasksCache.data = fetchedTasks;
        } else {
          const taskMap = new Map(tasksCache.data.map(t => [String(t.id || t.ID), t]));
          fetchedTasks.forEach(t => {
            taskMap.set(String(t.id || t.ID), t);
          });
          tasksCache.data = Array.from(taskMap.values());
        }
        tasks = tasksCache.data;
        tasksCache.lastFetch = now;
      } catch (e) {
        if (tasksCache.data) tasks = tasksCache.data;
        else return;
      }
    } else {
      if (tasksCache.data) tasks = tasksCache.data;
      else return;
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
  if (nagiosStatusCache.data) {
    ws.send(JSON.stringify({
      type: "nagios_update",
      services: nagiosStatusCache.data,
      timestamp: new Date(nagiosStatusCache.lastFetch).toISOString()
    }));
  }
  if (tasksCache.data) {
    ws.send(JSON.stringify({
      type: "tasks_update",
      tasks: tasksCache.data,
      timestamp: new Date(tasksCache.lastFetch).toISOString()
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

