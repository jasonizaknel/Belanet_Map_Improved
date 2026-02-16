# Global Architecture

## A. Entry Points
- Server runtime: `server.js` (Express + WebSocket) listening on port 5505, exposes REST endpoints under `/api/*` (tasks, config, weather, tracker positions, etc.) and serves static assets.
- UI bootstrap: `map.html` loads UI scripts, initializes Google Maps via `window.initMap`, and mounts the sidebar/dashboard and simulation UI.
- Scripts (ops/utility): root-level Node scripts such as `list_hosts.js`, `list_hosts_v2.js`, `verify_markers.js`, `check_markers.js`, `debug_admins.js`, and `test_tasks.js` executed ad‑hoc.

## B. Subsystem Breakdown
- UI Layer
  - `map.html` (layout, Tailwind, icons, and main panels)
  - Global state in `state.js` (`window.AppState`, visibility flags, timers, simulation state, team state)
  - Components and UI logic in `User Interface/`:
    - `OperationalDashboard.js`, `Sidebar.js`, `TeamSidebar.js`, `Searchbar.js`
  - Marker rendering and data loading in `Marker Scripts/Markers.js`
  - Simulation and playground logic in `Marker Scripts/Simulation.js`
- Marker / Simulation Logic
  - Marker data flow: loads towers, customers, tasks, service logins; builds associations and renders markers/polylines
  - Simulation loop: agents, routes, task queues, dashboards, and UI controls
- Weather System
  - Client overlay and services under `src/weather/`: `WeatherOverlay.js`, `WeatherService.js`, `ClockManager.js`, plus `weather-overlay.css`
  - Server-side weather proxying/caching in `server.js` with `weatherCache` and OneCall API 3 tracking (rate‑limit stats persisted to `Data/weather-api-stats.json`)
- State & Data Flow
  - `state.js` exposes `window.AppState` consumed by UI, markers, simulation, and overlays
  - Server aggregates external systems: Splynx (tasks), Traccar (trackers), Nagios (tower/service status), OpenWeather (weather)
  - WebSocket in `server.js` for live updates; REST for on‑demand fetches
- Utilities & Scripts
  - Data reconciliation and diagnostics scripts at repo root (lists, mismatch checks, verification, reporting)

## C. Dependency Flow Diagrams

UI → Service → Data

```
map.html
  └─> state.js (window.AppState)
  └─> Marker Scripts/Markers.js
  └─> Marker Scripts/Simulation.js
  └─> User Interface/* (dashboards, sidebars)
        │
        ├─ fetch('/api/tasks' | '/api/positions' | '/api/weather' | '/api/config')
        ▼
server.js (Express + WS)
  ├─ Splynx (tasks)
  ├─ Traccar (GPS/positions)
  ├─ Nagios (service status)
  └─ OpenWeather (weather)
        │
        ▼
Data/* (JSON, XLSX, persisted stats)
```

Weather Overlay Pipeline

```
UI (map.html)
  └─> ensure libs (__ensureWeatherLibs)
      ├─ src/weather/ClockManager.js
      ├─ src/weather/WeatherService.js  (calls /api/weather, /api/onecall)
      └─ src/weather/WeatherOverlay.js  (mounts overlay, events)
            │
            ▼
server.js weather endpoints
  └─ caches (weatherCache, coordWeatherCache)
  └─ OpenWeather OneCall v3
```

Marker Generation & Consumption

```
Markers.js
  ├─ getTowers() -> Data/highsite.json
  ├─ getCustomers() -> Data/customers.json
  ├─ getTasks() -> /api/tasks (fallback Data/tasks.json)
  ├─ getServiceLogins() -> Data/servicelogin.json
  └─ loadServiceLinks() -> Data/servicesId.json + tower mapping
        │
        ▼
  renderMarkers() / polylines / customer↔tower links
        │
        ▼
OperationalDashboard.js / Sidebar.js
  └─ consumes AppState, renders metrics and controls
```
