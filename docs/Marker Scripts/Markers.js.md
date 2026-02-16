# Markers.js — File

- Name: Markers.js
- Path: ./Marker Scripts/Markers.js
- Type: JavaScript (browser)

## Purpose & Responsibility
Core frontend logic for loading domain data (towers, customers, tasks, service logins, tracker positions), mapping tasks to customers, rendering map markers/links, integrating weather layers, and maintaining WebSocket connections.

## Internal Structure
- Status helpers: `getTaskStatusLabel` (lines ~6–23)
- Data loaders: `getTowers`, `getConfig`, `getCustomers`, `fetchTasks`, `getTasks`, `getServiceLogins`, `getTrackerPositions` (lines ~29–123)
- Service links: `loadServiceLinks` with robust tower matching heuristics (lines ~126–186)
- Weather integration: `getWeatherServiceInstance`, `fetchWeatherData`, `start/stopWeatherRefresh` (lines ~195–246)
- App bootstrap: `loadData()` orchestrates config→towers→customers→tasks→logins→trackers (lines ~248–279)
- Map init and overlay mounting: `window.initMap` (lines ~289–371)
- Rendering: `renderMarkers`, `renderTowers`, `renderTrackerMarkers`, links, Nagios processing (beyond 371+)

## Dependency Mapping
- Outbound: `/api/*` endpoints (tasks, positions, onecall), local `Data/*` files, Weather modules under `src/weather/*`
- Inbound: Called from `map.html` and UI modules via global functions

## Line References
- Data loading entry: `loadData()` ~248
- Map init: `initMap` ~289
- Service link creation: ~161–179

## Bug & Risk Notes
- Global state mutation on `window.AppState` couples modules tightly
- Multiple fetch fallbacks and local file loads can hide API errors
- Tower matching heuristics may yield false positives/negatives

## Deletion & Cleanup Suggestions
- None
## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
