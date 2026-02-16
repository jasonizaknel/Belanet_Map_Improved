# Analysis Summary

## System Purpose
Belanet Map Improved is a geospatial operations dashboard that unifies network monitoring, workforce tasks, GPS tracking, and weather context on top of a Google Map. It integrates with Splynx (tasks/admins), Traccar (tracker positions/devices), Nagios (host/service health), and OpenWeather (One Call 3.0). A Node.js server exposes REST and WebSocket endpoints, while a browser UI renders markers, overlays, dashboards, and simulation tooling.

- **Backend**: [./server.js.md](./server.js.md)
- **Frontend Shell**: [./map.html.md](./map.html.md)
- **Global State**: [./state.js.md](./state.js.md)
- **Marker/Simulation Logic**: [./Marker%20Scripts/Markers.js.md](./Marker%20Scripts/Markers.js.md), [./Marker%20Scripts/Simulation.js.md](./Marker%20Scripts/Simulation.js.md)
- **Weather Modules**: [./src/weather/WeatherService.js.md](./src/weather/WeatherService.js.md), [./src/weather/WeatherOverlay.js.md](./src/weather/WeatherOverlay.js.md), [./src/weather/ClockManager.js.md](./src/weather/ClockManager.js.md)
- **UI Modules**: [./User%20Interface/OperationalDashboard.js.md](./User%20Interface/OperationalDashboard.js.md), [./User%20Interface/Sidebar.js.md](./User%20Interface/Sidebar.js.md), [./User%20Interface/Searchbar.js.md](./User%20Interface/Searchbar.js.md), [./User%20Interface/TeamSidebar.js.md](./User%20Interface/TeamSidebar.js.md)
- **Tests (Playwright)**: [./tests/README.md](./tests/README.md)
- **Data & Assets**: [./Data/README.md](./Data/README.md)

## Core Subsystems
1. **Integration Server**: Single-file Express + WebSocket app providing endpoints for configuration, tasks, trackers, Nagios scraping, and weather. Uses in-memory caches and periodic broadcast loops. See [./server.js.md](./server.js.md).
2. **Frontend Map & UI**: A large static HTML container with tabs and controls, loaded via script tags/CDNs. UI modules manipulate the DOM and interact via `window.AppState`. See [./map.html.md](./map.html.md), [./User%20Interface/README.md](./User%20Interface/README.md).
3. **State Management**: Centralized `window.AppState` global with persistence to localStorage and event dispatch via `stateChanged`. See [./state.js.md](./state.js.md).
4. **Markers & Simulation**: Monolithic files that load data, render on the map, and power simulation/optimization behaviors. See [./Marker%20Scripts/Markers.js.md](./Marker%20Scripts/Markers.js.md), [./Marker%20Scripts/Simulation.js.md](./Marker%20Scripts/Simulation.js.md).
5. **Weather Feature**: Self-contained overlay and service with caching, resampling, and usage counters, partly duplicating concerns with the server’s own weather cache. See [./src/weather/README.md](./src/weather/README.md).
6. **Test Suite**: Playwright-based specs for weather modules and UI flows; assumes a running server and map page. See [./tests/README.md](./tests/README.md).
7. **Data Layer**: Icons and generated reports referenced by server/UI; reports are transient artifacts. See [./Data/README.md](./Data/README.md), [./Data/reports/README.md](./Data/reports/README.md).

## Observed Architectural Patterns
- **Monolith with Internal Services**: A single `server.js` encapsulates multiple integrations (Splynx, Traccar, Nagios, OpenWeather) and manages caches, auth, scraping, and broadcasting.
- **Global Frontend State**: `window.AppState` pattern enables loose coupling between modules through shared mutable state and CustomEvents.
- **UMD/CommonJS Frontend Modules**: Weather components use UMD wrappers for portability and are loaded via script tags rather than ES module imports.
- **HTML-Driven UI Composition**: Static `map.html` structure with strong reliance on IDs/classes and external CDNs for styling and icons.
- **Client/Server Duplication**: Overlapping concerns between client `WeatherService` caching/usage tracking and server-side weather cache/endpoints.
- **Playwright-Assisted Integrations**: Server uses headless browser automation for Splynx session/CSRF handling.

## Noted Inconsistencies & Ambiguities
- **Missing Architecture Index**: [./_index.md](./_index.md) links to [./_architecture.md](./_architecture.md), which is not present, suggesting architectural intent is under-documented.
- **Cache Ownership**: Documentation indicates both client and server cache weather data with independent TTLs and counters; ownership and conflict resolution are not specified.
- **Admin Auth Model**: Server uses an `X-Admin-Token` header and screen-scraped sessions for some Splynx flows; division of responsibilities and rotation policies are not documented.
- **Test Environment Assumptions**: Tests assume a running server on port 5505 and network availability; setup/teardown contracts are not captured in `package.json` scripts. See [./package.json.md](./package.json.md).
- **Data Hygiene**: Generated reports under `Data/reports` are documented as transient yet exist in the repository; retention policy is not explicit.
- **Heuristic Matching**: Marker linkage and team/tracker matching rely on string heuristics; documented risks but no formal schema or mapping rules.

## Cross-References
- Cleanup candidates and duplication clusters are tracked in [./_cleanup-report.md](./_cleanup-report.md).
- Technical debt hotspots are indexed in [./_technical-debt.md](./_technical-debt.md).
