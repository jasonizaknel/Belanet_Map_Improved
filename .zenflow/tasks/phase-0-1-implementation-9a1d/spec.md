# Phase 0–1 Technical Specification

## Technical Context
- Runtime: Node.js (CommonJS modules), Express HTTP server, `ws` for WebSocket
- Key server dependencies in use:
  - express, ws, axios, dotenv, cheerio, playwright, xlsx
  - Node 18+ global `fetch` is used alongside axios
- Frontend entrypoint: `map.html` served statically by Express
- Tests present: Playwright specs in `./tests/` but no `npm test` script defined
- Current server topology:
  - Monolithic `server.js` handles HTTP routes, WebSocket broadcasting, caching, and integration logic for Traccar, Splynx, Nagios, and Weather
  - Ad‑hoc logging via `console.*`, scattered retry/timeout logic, and in‑file caches

## Goals (Phase 0 & 1)
- Add structured JSON logging, metrics, and health/readiness without changing behavior
- Extract integration logic from `server.js` into focused service modules
- Normalize retry/timeout policies and centralize them
- Maintain API/WebSocket payload parity and cache semantics

## Implementation Approach

### Phase 0: Safety & Visibility

1) Structured Logging Baseline
- Create `observability/logger.js` exposing a minimal JSON logger with levels: debug, info, warn, error
- Include fields on every log: timestamp (ISO), level, subsystem, event, requestId (if present), and safe metadata
- Add Express middleware `requestContext` that:
  - Derives `requestId` from `X-Request-Id` header or generates one (UUID-lite) and stores on `req` and in `res.locals`
  - Attaches a child logger bound to `{ subsystem: 'http', requestId }`
- WS events will propagate a generated correlation id per broadcast cycle
- Redaction: central `redact(obj|string)` masking values for keys that match `/key|token|secret|pass|authorization/i` and any env var names we load
- Replace `console.*` in server paths with the logger; preserve messages and severity; keep wording to avoid behavior drift

2) Metrics & Telemetry
- Create `observability/metrics.js` with an in‑memory collector:
  - Counters: `http_requests_total{method,path,status}`, `ws_broadcast_total{type}`, `integration_calls_total{name,outcome}`, `cache_events_total{name,event}` where event ∈ {hit, miss, refresh}
  - Gauges: `ws_clients`
- Express middleware increments request counters; route wrappers record per‑endpoint counts
- Service methods emit success/failure counters; cache getters record hit/miss
- Expose read‑only `GET /metrics.json` returning a stable JSON snapshot:
  - `{ counters: { name: { labelKey: { ... } } }, gauges: { name: value } }`
  - No auth; read‑only

3) Health & Readiness Endpoints
- `GET /health` → `{ status: 'ok', pid, uptime }` with HTTP 200 if process is alive
- `GET /ready` → `{ ready: boolean, checks: { env: boolean, traccar: 'unknown|ok|disabled', splynx: 'unknown|ok|disabled', nagios: 'unknown|ok|disabled', weather: 'unknown|ok|disabled' } }`
  - env check: required config present with safe defaults; never blocks startup
  - dependency checks reflect last successful initialization or recent successful call from each service; they must not actively block or delay startup

4) CDN & Dependency Safety
- Identify current external assets in `map.html`:
  - Google Fonts (Inter), Tailwind CDN, Lucide via unpkg, Animate.css via cdnjs, Google Maps JS API
- Pin versions and add integrity where feasible:
  - Tailwind: pin to a known 3.x version URL with SRI
  - Lucide: replace `@latest` with a specific version and SRI
  - Animate.css: keep exact version used and SRI
  - Google Fonts and Maps cannot use SRI; keep as‑is but handled via server‑provided key
- Fallback strategy (no bundler):
  - Add `onerror` fallbacks to local `./vendor/*` copies for Tailwind/Lucide/Animate.css
  - Keep behavior unchanged; only affects resilience if CDN fails
  - Document inline in `map.html` near the tags

5) Secrets & Risk Hygiene
- Remove hardcoded secrets in `./test_tasks.js`; refactor to read from env if this utility remains
- Add `.env.example` enumerating required env vars already referenced in `server.js`:
  - TRACCAR_URL, TRACCAR_USER, TRACCAR_PASS, ENABLE_TRACCAR
  - SPLYNX_URL, SPLYNX_READ_ONLY_KEY, SPLYNX_ASSIGN_KEY, SPLYNX_SECRET, ENABLE_SPLYNX_TASKS, SPLYNX_ADMIN_USER, SPLYNX_ADMIN_PASS
  - NAGIOS_URL, NAGIOS_USER, NAGIOS_PASS
  - GOOGLE_MAPS_KEY, OPENWEATHER_API_KEY, ADMIN_TOKEN
- Ensure `.gitignore` excludes `.env`, `Data/reports/*.json`, and other generated artifacts (augment if needed)
- Logger redacts sensitive values automatically

### Phase 1: Structural Refactor

1) Extract Integration Services (no behavior change)
- Create `services/TrackerService.js`
  - Methods: `getPositions()`, `getDevices()`
  - Internal: axios/fetch requests with retry/timeout, in‑memory caches with same TTLs; emits logs/metrics; ensures icon folders
- Create `services/SplynxService.js`
  - Methods: `getAdministrators()`, `getTasks()`, `assignTasks(taskIds, technicianId, name)` and `addComment(taskId, technicianName)`
  - Internal: handles Basic auth, Playwright session for comments, paginated Excel‑guided fetch; caches and merge semantics identical to current
- Create `services/NagiosService.js`
  - Methods: `getStatus(hostName)`, `getAllStatus()`; caches and broadcast source of truth
- Create `services/WeatherBackend.js`
  - Methods: `getWeatherData()`, `getOneCall(lat, lon)` and stats getters/setters
  - Preserve existing `apiCallStats` persistence and `coordWeatherCache` TTL semantics

2) Normalize Retry & Timeout Policies
- Create `utils/httpClient.js`
  - Exports `request({ method, url, headers, data, timeout, retries, backoffBase })`
  - Defaults: `timeout=10000`, `retries=2`, exponential backoff with jitter; override per call
  - Uses axios (already a dependency) to avoid adding libraries
  - Emits `metrics.integration_calls_total` and `logger` events with redaction applied

3) Server Composition Cleanup
- `server.js` responsibilities after refactor:
  - Express and WS wiring, route declarations, and timer setup only
  - Construct services with shared `logger` and `metrics` instances and feature flags from env
  - Routes delegate to service methods; WebSocket broadcasts pull data from services; no direct integration logic remains
- Maintain identical response shapes and WebSocket payloads

## Source Code Changes

New files
- `observability/logger.js`
- `observability/metrics.js`
- `utils/httpClient.js`
- `services/TrackerService.js`
- `services/SplynxService.js`
- `services/NagiosService.js`
- `services/WeatherBackend.js`

Modified files
- `server.js` (route handlers delegate to services; add `/metrics.json`, `/health`, `/ready`; replace `console.*` with logger)
- `map.html` (pin CDN versions and add inline fallback comments; no functional UI change)
- `test_tasks.js` (remove hardcoded secrets; env‑driven if retained)
- `.gitignore` (ensure generated artifacts and `.env` are ignored if not already)
- Add `.env.example` (new file) listing vars; no runtime change required

Out of scope for Phase 0–1
- No changes to UI behavior, assignment algorithms, or Weather ownership (Phase 2)
- No ES module migration or RBAC redesign

## Data Model / API / Interface Changes
- No changes to existing API response shapes or WebSocket payloads
- New read‑only endpoints:
  - `GET /metrics.json` → JSON snapshot of counters/gauges
  - `GET /health` → process liveness
  - `GET /ready` → dependency readiness

## Verification Approach

1) Manual Smoke
- Start server: `npm start`
- Verify existing endpoints (`/api/*`) return identical shapes compared to current main branch or pre‑refactor baseline
- Connect a client (open `map.html`) and ensure WS updates still flow for trackers, Nagios, tasks, and weather

2) Observability
- Hit several endpoints and confirm logs are JSON, contain requestId, and redact secrets
- Inspect `/metrics.json` and check:
  - `http_requests_total` increments per path
  - Integration success/failure and cache hit/miss counters change as expected
  - `ws_broadcast_total` increments when timers fire; `ws_clients` reflects connections
- Confirm `/health` returns 200 and `/ready` transitions to ready once initial calls succeed or relevant flags/keys exist

3) Playwright Tests
- Project lacks a test script; confirm with maintainers how to run E2E
  - Expected: `npx playwright test` from repo root
- Tests must pass unchanged. If a command is provided, incorporate it in follow‑up automation

4) Non‑Regression
- Snapshot a few representative API responses and compare pre/post refactor
- Monitor logs/metrics during a 5–10 minute run to ensure no error floods or retry storms

## Risk Management & Rollback
- Keep changes behind module boundaries; avoid changing route paths or payloads
- If regressions appear, logger context and metrics allow quick triage
- Rollback plan: revert to pre‑refactor `server.js` while keeping non‑intrusive `/health` and `/metrics.json` endpoints gated behind feature flags if needed
