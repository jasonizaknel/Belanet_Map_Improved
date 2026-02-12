---
description: Repository Information Overview
alwaysApply: true
---

# Belanet_Map_Improved Repository Overview

## Summary
The **Belanet Map Improved** project is a real-time network management and visualization dashboard for ISPs. It integrates **Splynx** (tasks/customers), **Traccar** (GPS trackers), and **Nagios** (network monitoring), with a robust **Simulation Mode**, an event-driven **Operational Dashboard**, and configurable **Weather Overlay** using OpenWeather One Call 3.0. Real-time updates are delivered via WebSockets for trackers, Nagios, tasks, and simulated weather events.

## Structure
- **Backend**: [./server.js](./server.js) (Express + WebSocket server)
- **Frontend**: [./map.html](./map.html) (Core UI)
- **Logic**: [./Marker Scripts/](./Marker%20Scripts/) (Map interactions & Simulation)
- **UI Components**: [./User Interface/](./User%20Interface/) (Sidebars & Dashboards)
- **State**: [./state.js](./state.js) (Global application state)
- **Weather Modules**: [./src/weather/](./src/weather/) → `WeatherService.js`, `ClockManager.js`, `WeatherOverlay.js`, `weather-overlay.css`

## Language & Runtime
**Language**: JavaScript (Node.js & Browser)  
**Version**: Node.js (CommonJS)  
**Build System**: npm  
**Package Manager**: npm  

## Dependencies
**Main Dependencies**:
- **express**: Web server framework (Port 5505)
- **ws**: WebSocket support for real-time updates
- **xlsx**: Excel data processing (Belanet Tasks Export.xlsx)
- **playwright**: Splynx UI login/session capture for comment posting
- **axios**: HTTP client for API integrations
- **cheerio**: HTML parsing for Nagios/Splynx extraction
- **dotenv**: Environment variable management

## Backend: [./server.js](./server.js)
- **adminAuth** (`128`): Middleware securing admin APIs via `X-Admin-Token`.
- **getSplynxSession** (`151`): Headless Playwright login; caches session cookies.
- **addSplynxComment** (`223`): Adds task comment via UI emulation with CSRF token.
- **loadTaskIdsFromExcel** (`278`): Reads task IDs from `Data/Belanet Tasks Export.xlsx`.
- **fetchTasksFromSplynx** (`308`): Fetches tasks by ID list with chunked concurrency; normalizes `Title/Description`.
- **getWeatherData** (`378`): One Call 3.0 fetch with server-side caching and graceful fallbacks.
- **fetchFromNagios** (`430`): Downloads Nagios status HTML (hosts/services) with Basic auth.
- **parseNagiosHostHTML** (`476`): Parses host-level status entries from Nagios.
- **parseNagiosHTML** (`516`): Parses service-level status entries from Nagios.
- **broadcastNagiosStatus** (`1015`): Pushes aggregated Nagios status to clients.
- **broadcastTrackerPositions** (`1060`): Streams tracker positions; caches between ticks.
- **broadcastTasks** (`1108`): Streams Splynx tasks with merge-into-cache semantics.
- **broadcastWeatherEvents** (`1160`): Simulated lightning events; ready for real data sources.

- **API Endpoints**
  - `/api/config` (`579`): Public config (keys, feature toggles)
  - `/api/nagios/toggle` `POST` (`592`): Enable/disable Nagios fetch (admin)
  - `/api/simulation/report` `POST` (`599`): Persist simulation reports
  - `/api/positions` (`614`): Latest tracker positions (cached)
  - `/api/devices` (`666`): Tracker devices (cached)
  - `/api/administrators` (`711`): Splynx admins (admin, cached)
  - `/api/tasks` (`767`): Splynx tasks with rolling pagination/cache
  - `/api/weather` (`812`): Cached One Call 3.0 snapshot
  - `/api/onecall` (`839`): Point query; deduped by 0.01° grid with call-limit tracking
  - `/api/weather/stats` (`878`), `/api/weather/stats/limit` (`888`), `/api/weather/stats/reset` (`901`): API call usage controls
  - `/api/tasks/assign` `POST` (`914`): Assign tasks via API (PUT) + UI comment (admin)
  - `/api/nagios/toggle` `GET` (`967`): Alternate toggle via query param
  - `/api/nagios/status/:hostName` (`974`): Per-host combined host+service status

## Frontend Logic: [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js)
- **loadServiceLinks** (`126`): Links customers to towers using service login/tower heuristics
- **loadData** (`248`): Loads config → towers → customers → tasks → service logins → trackers; renders markers
- **getCustomerIcon** (`404`): Dynamic SVG marker based on task load/age and tower status
- **updateWeatherLayers** (`520`): Adds/removes OpenWeather tile overlays; defaults to `clouds_new`
- **renderTrackerMarkers** (`626`): Renders/updates tracker markers with info windows
- **connectTrackerWebSocket** (`712`): Real-time updates for trackers/Nagios/tasks/weather
- **renderServiceLinks** (`867`): Polylines between customers and towers with hover animation
- **processNagiosStatus** (`924`): Aggregates Nagios data by host; computes counts/status
- **getTowerStatusColor** (`975`): Computes tower color from Nagios/simulation
- **renderTowers** (`1090`): Animated SVG tower markers; info windows with sectors/host status
- **updateCustomerMarkerVisibility** (`1300`): Filter engine; updates links and sidebar list
- **mapTasksToCustomers** (`1819`): Maps active tasks to customers by name/ID

## Frontend Logic: [./Marker Scripts/Simulation.js](./Marker%20Scripts/Simulation.js)
- **assignTaskToAgent** (`1337`): Manual assignment in simulation.
- **redistributeAllTasks** (`1398`): VRP-style redistribution across agents.
- **getPredictiveTrafficFactor** (`1557`): Speed factor by virtual time of day.
- **updateSimulation** (`1576`): Main movement/engine loop.
- **markTaskCompleted** (`1709`): Completes task and updates stats.
- **simulateStormEvent** (`2143`): Random outages/emergency tasks generator.
- **solve2Opt** (`2234`): 2-opt route optimization.

## User Interface: [./User Interface/OperationalDashboard.js](./User%20Interface/OperationalDashboard.js)
- **updateOperationalDashboard** (`188`): Central UI refresh.
- **handleTaskAssignment** (`205`): Bridges Live vs Simulation assignment.
- **aggregateAllTasks** (`238`): Normalizes/filters active tasks (live + sim).
- **aggregateAllAgents** (`292`): Combines tracker-derived and sim agents.
- **updateHeartbeatMetrics** (`349`): High-level ISP health metrics.

## User Interface: [./User Interface/TeamSidebar.js](./User%20Interface/TeamSidebar.js)
- **fetchAdministrators** (`1`): Loads Splynx admins (admin auth header).
- **renderTeamMembers** (`66`): Renders/updates team list with actions.
- **updateMemberStats** (`151`): Computes live task list and distance from tracker.
- **handleAutoAssign** (`310`): Bulk assign via `/api/tasks/assign` then refresh tasks.

---

**Maintenance Note**: Keep function names, line numbers, and roles updated to assist other agents in project navigation.
