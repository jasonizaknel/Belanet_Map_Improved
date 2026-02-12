---
description: Repository Information Overview
alwaysApply: true
---

# Belanet_Map_Improved Repository Overview

## Summary
The **Belanet Map Improved** project is a sophisticated network management and visualization dashboard. It integrates real-time data from **Splynx** (tasks and customers), **Traccar** (GPS tracking), and **Nagios** (network monitoring). The application features a robust **Simulation Mode** for agent routing optimization, high-definition road-accurate routing, and a comprehensive **Operational Dashboard** for ISP health monitoring.

## Structure
- **Backend**: [./server.js](./server.js) (Express/WS server)
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
- **playwright**: UI-based data scraping and session management for Splynx
- **axios**: HTTP client for API integrations
- **cheerio**: HTML parsing for Nagios/Splynx data extraction
- **dotenv**: Environment variable management

## Backend: [./server.js](./server.js)
- **adminAuth** (Line 81): Middleware for securing administrative API endpoints.
- **getSplynxSession** (Line 104): Automates Splynx UI login using Playwright to capture session cookies.
- **addSplynxComment** (Line 176): Emulates UI interaction to add comments to tasks.
- **loadTaskIdsFromExcel** (Line 231): Parses `Belanet Tasks Export.xlsx` to extract specific task IDs.
- **fetchTasksFromSplynx** (Line 261): Core logic for fetching task details from Splynx API.
- **fetchFromNagios** (Line 331): Orchestrates fetching of Nagios status pages.
- **parseNagiosHostHTML** (Line 377): Cheerio-based parser for Nagios host status.
- **parseNagiosHTML** (Line 417): Cheerio-based parser for Nagios service status.
- **broadcastNagiosStatus** (Line 810): Broadcasts Nagios updates via WebSocket.
- **broadcastTrackerPositions** (Line 855): Broadcasts Traccar updates via WebSocket.
- **broadcastTasks** (Line 903): Broadcasts Splynx task updates.

## Frontend Logic: [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js)
- **loadServiceLinks** (~Line 111): Establishes connections between customers and towers
- **loadData** (~Line 179): Orchestrates the loading of all data sources and initializes map overlays
- **updateWeatherLayers** (~Line 440): Attaches/removes OpenWeather tile overlays; now uses MVCArray-safe removal and defaults to `clouds_new`
- **getCustomerIcon** (~Line 258): Generates dynamic SVG markers based on task counts (anger levels)
- **renderTrackerMarkers** (~Line 353): Renders moving technician markers
- **connectTrackerWebSocket** (~Line 439): Establishes WebSocket connection for real-time data
- **renderServiceLinks** (~Line 586): Draws and animates polylines connecting customers to highsites
- **processNagiosStatus** (~Line 643): Aggregates Nagios data into host-level status summaries
- **getTowerStatusColor** (~Line 694): Determines tower visual state (Red/Orange/Green)
- **renderTowers** (~Line 809): Renders status-aware tower markers with animated SVGs
- **updateCustomerMarkerVisibility** (~Line 1019): Filtering engine for marker visibility
- **mapTasksToCustomers** (~Line 1460): Maps global tasks to customer objects for UI display

## Frontend Logic: [./Marker Scripts/Simulation.js](./Marker%20Scripts/Simulation.js)
- **assignTaskToAgent** (Line 1337): Handles manual task assignment in simulation.
- **redistributeAllTasks** (Line 1398): VRP algorithm for route optimization across agents.
- **getPredictiveTrafficFactor** (Line 1557): Adjusts simulation speed based on virtual time of day.
- **updateSimulation** (Line 1576): Main movement engine for simulated agents.
- **markTaskCompleted** (Line 1709): Formal task completion and inventory depletion.
- **simulateStormEvent** (Line 2143): Generates random outage scenarios and emergency tasks.
- **solve2Opt** (Line 2234): 2-opt optimization algorithm for travel distance minimization.

## User Interface: [./User Interface/OperationalDashboard.js](./User%20Interface/OperationalDashboard.js)
- **updateOperationalDashboard** (Line 188): Central refresh function for the dashboard UI.
- **handleTaskAssignment** (Line 205): Bridge for Live API or Simulation assignments.
- **aggregateAllTasks** (Line 238): Normalizes Splynx and Simulated tasks.
- **aggregateAllAgents** (Line 292): Normalizes Live and Simulated agents.
- **updateHeartbeatMetrics** (Line 349): Calculates high-level ISP health metrics.

## User Interface: [./User Interface/TeamSidebar.js](./User%20Interface/TeamSidebar.js)
- **fetchAdministrators** (Line 1): Retrieves available staff from Splynx API.
- **renderTeamMembers** (Line 66): Renders the list of active technicians.
- **updateMemberStats** (Line 151): Calculates real-time stats for specific technicians.
- **handleAutoAssign** (Line 310): Processes bulk task assignments via server API.

---

**Maintenance Note**: Keep function names, line numbers, and roles updated to assist other agents in project navigation.
