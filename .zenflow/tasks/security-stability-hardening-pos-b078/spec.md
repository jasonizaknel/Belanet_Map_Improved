# Security & Stability Hardening — Technical Specification (Post Phase 1)

## Objective
Harden security and stability across the stack by addressing the 12 documented risks without introducing Phase 2+ architectural refactors or new product features. All changes must be incremental, defensible, and traceable to a risk item (R1–R12).

## Scope & Constraints
- Do not replace Playwright or redesign ownership models (defer to later phases)
- No framework migrations or bundlers
- Allow behavior changes that improve safety/observability with clear justification
- Prefer small, targeted edits over broad refactors

## Technical Context
- Runtime: Node.js (CommonJS)
- Server: Express + `ws` (WebSocket)
- HTTP: native `fetch` with centralized helper in [./lib/http.js](./lib/http.js)
- Logging: structured logger with redaction in [./lib/logger.js](./lib/logger.js)
- Metrics: in-memory counters/gauges in [./lib/metrics.js](./lib/metrics.js)
- Integrations: Traccar, Splynx, Nagios, OpenWeather
- Headless automation: Playwright in [./services/SplynxService.js](./services/SplynxService.js)
- UI: static [./map.html](./map.html) with CDN assets, client JS in `./User Interface/*.js` and `./src/weather/*`
- Config: `.env` via `dotenv`; example in [./.env.example](./.env.example)

Key entry points and caches observed:
- Server entry: [./server.js](./server.js)
- Ad-hoc caches: `nagiosStatusCache`, `tasksCache`, `adminsCache`, `trackerCache`, `devicesCache`, `weatherCache`, `coordWeatherCache` in [./server.js](./server.js)
- Splynx internal caches and session in [./services/SplynxService.js](./services/SplynxService.js)

## Risk-by-Risk Implementation Approach

### R1) Splynx Session via Playwright Is Brittle
- Add circuit-breaker to `SplynxService`:
  - Track consecutive failures for login, CSRF extraction, and comment POST
  - Open circuit for e.g. 15 minutes after N failures; short-circuit calls and return explicit error states
- Enforce explicit time ceilings:
  - Global per-operation caps (login, view page, CSRF parse, submit) with a total wall-clock cap
- Structured logs & metrics:
  - `subsystem: 'splynx'` with stages: `login_start|success|failure`, `csrf_extract_*`, `comment_post_*`
  - Metrics: `integration_calls_total{service=splynx,op=login|comment,status}`; gauges for circuit state
- Fail fast and degrade gracefully:
  - Avoid infinite retries; use `fetchWithRetry` bounded attempts
  - Return `{assigned:false, commented:false, reason:'circuit_open|csrf_missing|login_failed'}`

Touched files
- Update: [./services/SplynxService.js](./services/SplynxService.js)
- Reuse: [./lib/http.js](./lib/http.js), [./lib/logger.js](./lib/logger.js), [./lib/metrics.js](./lib/metrics.js)

### R2) Global In-Memory Caches with Concurrency Risks
- Introduce a minimal cache helper with:
  - TTL per entry, max-size with LRU eviction, and in-flight de-duplication (promise memoization)
  - Metrics: `cache_hit|cache_miss|cache_eviction` with `cache=<name>` labels
- Centralize usage:
  - Replace ad-hoc `*Cache` in [./server.js](./server.js) and internal caches in `SplynxService` with the helper
- Bound growth and stale amplification via uniform TTLs and max-size defaults

Touched files
- New: `./lib/cache.js` (small, dependency-free LRU+TTL)
- Update: [./server.js](./server.js), [./services/SplynxService.js](./services/SplynxService.js)
- Reuse: [./lib/metrics.js](./lib/metrics.js)

### R3) ENV Defaults to Empty Strings
- Add config loader that validates required env by feature:
  - Treat empty strings as undefined; coerce booleans from `ENABLE_*`
  - On missing critical vars when a feature is enabled, set readiness to false and log warnings
- Replace `|| ""` defaults with `undefined` and rely on loader values
- `/ready` should reflect config validation
- Update `.env.example` with explicit `REQUIRED WHEN ...` comments and remove misleading empty defaults

Touched files
- New: `./lib/config.js` (validation + normalized config)
- Update: [./server.js](./server.js), [./.env.example](./.env.example)

### R4) Client/Server Weather Cache Duplication (Interim)
- Runtime warning + logs clarifying ownership:
  - Client cache is advisory; server remains authoritative for now
- Visibility:
  - Log TTLs on both sides at init; expose server TTLs via `/metrics.json`
  - Client emits `service` events already; extend to include `cache_hit|miss` counts
- Metrics: compare client fetches vs server fetches per minute

Touched files
- Update: [./src/weather/WeatherService.js](./src/weather/WeatherService.js), [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js), [./server.js](./server.js)

### R5) Blocking File I/O on Request Path
- Replace sync I/O with async where feasible:
  - `fs.readdirSync`, `fs.readFileSync`, `fs.writeFileSync` → async equivalents
- Move heavy XLSX parsing off request path:
  - Preload on startup or via a background task; keep `/api/tasks/reload` to trigger refresh
- Add timing metrics around file ops and cache warmups

Touched files
- Update: [./lib/spreadsheetTasks.js](./lib/spreadsheetTasks.js), [./server.js](./server.js)

### R6) External CDN Dependency for UI
- Pin exact versions and add SRI for Tailwind, Lucide, Animate.css in [./map.html](./map.html)
- Add basic offline fallback comment and graceful-degradation notes in [./docs/map.html.md](./docs/map.html.md)

Touched files
- Update: [./map.html](./map.html), [./docs/map.html.md](./docs/map.html.md)

### R7) Secrets Handling in Utilities and Tests
- Remove hardcoded secrets and replace with env-based configuration
  - Example offender: [./test_tasks.js](./test_tasks.js)
- If a script is only useful for manual debugging and unsafe, quarantine or delete
- Add lightweight secret scan to CI/docs and audit current repo history (document findings)

Touched files
- Update/Quarantine: [./test_tasks.js](./test_tasks.js), `./debug_admins.js`, `./list_hosts*.js`
- Update: [./.env.example](./.env.example), [./docs/_cleanup-report.md](./docs/_cleanup-report.md)

### R8) Tracker/Admin Name Matching by Heuristics
- Add normalization utils (case, whitespace, accents) for comparisons
- Detect ambiguities and surface to UI (e.g., show badge/warning, avoid auto-assign)
- Log ambiguous matches for server-side observability

Touched files
- Update: [./User Interface/TeamSidebar.js](./User%20Interface/TeamSidebar.js), possibly [./server.js](./server.js) if any server-side matching exists

### R9) WebSocket Broadcast Flooding
- Introduce per-topic rate limiting/batching with queues
- Apply backpressure strategy:
  - If `ws.bufferedAmount` exceeds threshold, drop non-critical messages or sample
- Metrics: `ws_client_count`, `ws_broadcast_total{type}`, `ws_dropped_total{reason,type}`; log reconnect storms

Touched files
- Update: [./server.js](./server.js)

### R10) Inconsistent Retry/Timeout Policies
- Ensure all outbound HTTP uses `fetchWithRetry` with bounded retries/timeouts
- Remove ad-hoc retry loops and standardize defaults at call sites

Touched files
- Update: [./server.js](./server.js), [./services/SplynxService.js](./services/SplynxService.js)
- Reuse: [./lib/http.js](./lib/http.js)

### R11) LocalStorage State Corruption
- Namespace keys with version, e.g., `belanet:v1:team_members`
- Add minimal schema/version checks; reset invalid state gracefully with a user-visible toast

Touched files
- Update: [./User Interface/TeamSidebar.js](./User%20Interface/TeamSidebar.js), [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js)

### R12) Test Environment Flakiness
- Document prerequisites and add toggles for network dependencies
- Add startup wait checks for any e2e flows (e.g., wait for `/ready`)
- Make ports configurable via env and avoid conflicts in tests

Touched files
- Update: [./docs/tests/README.md](./docs/tests/README.md), possibly lightweight harness scripts if needed

## Source Code Structure Changes
- New modules
  - `./lib/cache.js` — TTL + max-size LRU cache with in-flight de-dupe and metrics hooks
  - `./lib/config.js` — env normalization/validation and readiness signals
- Updated modules
  - [./services/SplynxService.js](./services/SplynxService.js) — circuit breaker, logs, timeouts
  - [./server.js](./server.js) — cache helper usage, websocket rate limit/batching, file I/O async, metrics
  - [./lib/spreadsheetTasks.js](./lib/spreadsheetTasks.js) — async I/O, preload path
  - [./map.html](./map.html) — pinned CDN + SRI
  - [./User Interface/TeamSidebar.js](./User%20Interface/TeamSidebar.js) — normalization, storage namespace/versioning
  - [./src/weather/WeatherService.js](./src/weather/WeatherService.js), [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js) — advisory warnings and metrics hooks
  - [./.env.example](./.env.example) — remove empty-string defaults, clarify requirements
  - Unsafe utilities/tests updated or quarantined (e.g., [./test_tasks.js](./test_tasks.js))

## Data Model / API / Interface Changes
- No new product features
- Behavior changes
  - `/ready` may return 503 when features are enabled without required env; this is intentional for visibility (R3)
  - WebSocket updates may be batched or rate-limited; clients should handle same message shapes with coalesced payloads (R9)
  - Splynx comment/assign endpoints now return explicit error objects instead of silent fallbacks (R1)
- UI
  - LocalStorage keys are versioned; invalid or legacy state resets with a soft notice (R11)
  - Client console/runtime warnings clarify weather cache status (R4)

## Verification Approach
1) Build/Start
   - Run `npm start` and load the app at `http://localhost:5505` (default as per [./package.json](./package.json))
2) Readiness & Config (R3)
   - With missing required vars while a feature is enabled, `/ready` returns 503 and logs explicit missing fields
   - With correct vars, `/ready` returns 200
3) Splynx Circuit (R1)
   - Simulate bad credentials; observe circuit opens via metrics and logs; subsequent calls short-circuit
   - Restore credentials; circuit half-opens and recovers after cooldown
4) Cache TTL/Eviction (R2)
   - Force repeated lookups; verify `cache_hit/miss/eviction` counters change; memory remains bounded at max-size
5) File I/O Latency (R5)
   - Invoke `/api/tasks/import` and `/api/tasks/reload`; verify no sync I/O on hot path; observe timing metrics
6) WebSocket Flooding (R9)
   - Connect multiple clients; trigger rapid updates; verify batching, drops under backpressure, and `ws_dropped_total`
7) Weather Duplication (R4)
   - Check console warnings and metrics showing client vs server fetch rates
8) ENV & Secrets (R3, R7)
   - Verify `.env.example` clarity and no hardcoded secrets in repo/scripts
9) CDN Integrity (R6)
   - Confirm SRI integrity attributes present and exact versions pinned; test offline degradation note in docs
10) LocalStorage (R11)
   - Corrupt stored JSON; verify reset and notice; normal path preserves state across reloads
11) Tests (R12)
   - Documented steps in `docs/tests/README.md` articulate startup/wait and flags for networked tests

## Rollout & Observability
- Enable changes behind minimal feature flags where feasible (e.g., circuit-breaker thresholds)
- Monitor metrics via `/metrics.json` during soak
- Keep logs structured for easy tailing and redaction safety

## Risks & Mitigations
- Minor behavior changes (ready gate, batching) may surprise some scripts; mitigated by documentation and compatibility of payload shapes
- Cache helper introduction touches multiple call sites; perform incremental replacement per area with tests/verification

## Out of Scope (Deferred)
- Replacing Playwright integration with API-only approach
- Weather ownership redesign and externalizing caches (e.g., Redis)
- Introducing a bundler or module system changes