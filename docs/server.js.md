# server.js — File

- Name: server.js
- Path: ./server.js
- Type: JavaScript (Node.js, CommonJS)

## Purpose & Responsibility
Express HTTP + WebSocket server for Belanet Map. Integrates with Splynx (tasks, admins), Traccar (trackers), Nagios (host/service status), and OpenWeather (One Call 3.0). Provides REST endpoints and pushes updates via WebSocket broadcast loops.

## Internal Structure
- Constants and config (lines ~18–47): ports, directories, env vars, refresh intervals
- Caches (lines ~48–81): nagiosStatusCache, tasksCache, adminsCache, trackerCache, devicesCache, weatherCache
- API usage stats (lines ~83–121, 301–326): `apiCallStats`, `_loadApiCallStatsFromDisk`, `_saveApiCallStatsToDisk`
- Admin auth middleware (lines ~128–149): `adminAuth(req,res,next)` checks `X-Admin-Token`
- Splynx session (lines ~151–221): `getSplynxSession()` with Playwright headless auth
- Splynx comment (lines ~223–276): `addSplynxComment(taskId, technicianName)` via CSRF-protected POST
- Excel helpers (lines ~279–311): read task IDs and list spreadsheet files
- Spreadsheet parse (lines ~312–352): `parseSplynxTasksFromFile(filePath)`
- Task cache auto-load (lines ~354–369): `tryAutoLoadSpreadsheetIntoCache()`
- Task fetch (lines ~371–400+): `fetchTasksFromSplynx()` with pagination/chunks
- Weather endpoints and stats: provides `/api/weather`, `/api/onecall`, `/api/weather/stats*` (lines ~812–901)
- Nagios fetch/parse/broadcast: HTML scraping and aggregation (lines ~430–1015)
- Trackers fetch/broadcast: positions and devices (lines ~1060–711/666 references)
- Tasks broadcast (lines ~1108): push task updates to clients
- Weather events broadcast (lines ~1160): simulated lightning/events
- REST endpoints (lines ~579–977): config, toggles, status, assign
- Server/WebSocket setup (lines ~13–17): initialization and binding

## Dependency Mapping
- Outbound:
  - `express`, `ws`, `http/https`, `dotenv` for server and transport
  - `axios`, `cheerio`, `xlsx`, `playwright` for external integrations
  - Local: `Data/*` files for persistence and Excel importing
- Inbound:
  - Consumed by `map.html` frontend via `/api/*` and WebSocket events
  - Utility scripts and UI modules assume endpoints exist
- External:
  - Splynx admin/tasks UI and API
  - Traccar trackers API
  - Nagios status CGI pages
  - OpenWeather One Call 3.0

## Line References
- Entry point/server start: ~13–21
- Admin auth middleware: ~128–149
- Splynx session: ~151–221
- Tasks endpoints: ~767–777
- Weather endpoints: ~812–901
- Nagios parsing: ~516–592
- WebSocket broadcasts: ~1015–1165

## Bug & Risk Notes
- Uses headless Playwright for CSRF/session scraping; brittle if UI changes
- Many global caches; race conditions possible under concurrent requests
- ENV var fallbacks to empty strings may lead to auth loops or 401s
- File I/O in request paths (Excel/JSON) may block event loop for large files
- Error handling varied; some console logging without client feedback consistency

## Deletion & Cleanup Suggestions
- None in this file. Consider extracting subsystems (Nagios, Splynx, Weather) into modules for testability and reducing tight coupling.

## Observability Endpoints
- GET `/metrics.json` — In-memory counters and gauges (HTTP requests, integration call status, cache hits/misses, WS broadcasts)
- GET `/health` — Liveness: `{ status, pid, uptime_s }`
- GET `/ready` — Readiness: `{ ready, details: { env, features } }`

## Service Modules (Extracted)
- `services/TrackerService.js` — Traccar positions/devices with caching and retry/timeout
- `services/NagiosService.js` — HTML fetch/parse + caching for Nagios hosts/services
- `services/SplynxService.js` — Admins/tasks fetch, assignment + UI comment via session caching
- `services/WeatherBackend.js` — One Call cache, per-coordinate cache, usage stats persistence
- `lib/spreadsheetTasks.js` — Spreadsheet import utilities (list files, parse tasks, load task IDs, auto-load cache)

## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
