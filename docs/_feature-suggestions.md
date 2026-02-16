# Feature & Capability Suggestions

Each suggestion is derived strictly from the documented system intent and gaps.

## 1) Unified Weather Cache Ownership & Quota UI
- **Description**: Make the server the single source of truth for weather caching and API usage; expose a small UI panel that reflects server-side counters/limits and per-client allocations.
- **Why It Fits**: Docs show duplicated client/server weather caching and counters. Consolidation reduces drift. See [./server.js.md](./server.js.md), [./src/weather/WeatherService.js.md](./src/weather/WeatherService.js.md).
- **Problem Solved**: Inconsistent TTLs/limits, double-counting, and debugging complexity.
- **Subsystems**: Server weather endpoints/caches, WeatherOverlay UI, WeatherService client.
- **Complexity**: Medium

## 2) Health and Readiness Endpoints + Basic Metrics
- **Description**: Add `/healthz` and `/readyz` endpoints and a lightweight metrics endpoint (e.g., JSON with cache sizes, queue lengths, broadcast rates, and error counters).
- **Why It Fits**: Server is integration-heavy with multiple caches and broadcasts; visibility improves operations. See [./server.js.md](./server.js.md).
- **Problem Solved**: Undiagnosed outages, blind spots in broadcast loops and scrapers.
- **Subsystems**: Server HTTP layer, caches, broadcast scheduler.
- **Complexity**: Low

## 3) WebSocket Reconnect & Backoff Strategy
- **Description**: Document and implement a client reconnection policy with exponential backoff and jitter; add server-side connection caps and heartbeat timeouts.
- **Why It Fits**: Broadcast loops are central; loss of connectivity is likely in the field.
- **Problem Solved**: Thundering herds after restarts; stale UI state after disconnects.
- **Subsystems**: Server WS loop, frontend bootstrap (Markers/UI init).
- **Complexity**: Medium

## 4) Admin Token Rotation & RBAC Scopes
- **Description**: Introduce short-lived admin tokens with scoped permissions for assignment/comment actions; rotate via a simple server endpoint gated by a static secret or OAuth proxy.
- **Why It Fits**: Docs show `X-Admin-Token` checks and Playwright-based Splynx flows; stronger hygiene reduces risk.
- **Problem Solved**: Long-lived shared tokens, unclear privileges.
- **Subsystems**: Server auth middleware, TeamSidebar interactions.
- **Complexity**: Medium

## 5) Task Auto-Assignment Heuristics v2
- **Description**: Formalize geospatial cost function including SLA urgency, travel time estimation, current workload, and skill tags; surface explainability in UI.
- **Why It Fits**: TeamSidebar and dashboard already compute distances and workloads.
- **Problem Solved**: Brittle string matching for tracker/admin mapping; opaque assignments.
- **Subsystems**: TeamSidebar, Markers data pipeline, potentially server-side scoring.
- **Complexity**: High

## 6) Structured Logging with Correlation IDs
- **Description**: Emit JSON logs with request IDs spanning REST, WebSocket broadcasts, and background scrapers.
- **Why It Fits**: Multi-integration server; correlating errors across subsystems is valuable.
- **Problem Solved**: Hard-to-trace failures across scraping and broadcast paths.
- **Subsystems**: Server request handlers and scrapers.
- **Complexity**: Low

## 7) Test Runner & Env Bootstrap Scripts
- **Description**: Add npm scripts to start the server, run Playwright tests, and configure required env vars via an `.env.example`.
- **Why It Fits**: Docs note missing scripts. See [./package.json.md](./package.json.md), [./tests/README.md](./tests/README.md).
- **Problem Solved**: Onboarding friction and flaky test setup.
- **Subsystems**: Tooling only; no runtime.
- **Complexity**: Low

## 8) Config Surface Consolidation
- **Description**: Centralize config toggles, refresh intervals, and third-party URLs into a documented config module plus a single UI pane.
- **Why It Fits**: Config spread across server constants and frontend globals.
- **Problem Solved**: Configuration drift and magic numbers.
- **Subsystems**: Server constants, AppState defaults, Sidebar/OperationalDashboard.
- **Complexity**: Medium

## 9) CDN Pinning & Local Fallbacks
- **Description**: Pin external CSS/icon versions and provide optional local fallbacks served by the backend.
- **Why It Fits**: `map.html` relies on Tailwind/Lucide/Animate CDNs. See [./map.html.md](./map.html.md).
- **Problem Solved**: Availability risk and visual regressions after upstream changes.
- **Subsystems**: map.html and static server middleware.
- **Complexity**: Low

## 10) Marker/Data Diagnostics Panel
- **Description**: In-app diagnostics view showing counts by type, last refresh, error tallies, and recent API calls.
- **Why It Fits**: Existing utilities like `verify_markers.js` indicate need; consolidating into UI helps triage.
- **Problem Solved**: Manual inspection and ad-hoc scripts for visibility.
- **Subsystems**: Markers.js, OperationalDashboard.
- **Complexity**: Medium

## 11) Simulation Engine/UX Separation
- **Description**: Separate simulation core loop from UI; add scenario presets and deterministic random seeds for reproducible demos/tests.
- **Why It Fits**: Docs call out monolithic Simulation.js with randomized elements.
- **Problem Solved**: Flaky visual tests; hard-to-reuse engine.
- **Subsystems**: Simulation.js, tests.
- **Complexity**: Medium

## 12) Nagios/Tracker Error Budget & Retries
- **Description**: Standardize retry/backoff, timeouts, and error budgets for scraping and polling calls; bubble status into health metrics.
- **Why It Fits**: Inconsistent error handling noted in docs.
- **Problem Solved**: Silent failures, uneven recovery behavior.
- **Subsystems**: Server fetchers, broadcast loops.
- **Complexity**: Medium
