# Technical Debt Index

- [server.js.md](./server.js.md) → Express HTTP + WebSocket server integrating Splynx, Traccar, Nagios, and OpenWeather; many global caches and side effects
- [map.html.md](./map.html.md) → Main page hosting Google Map and heavy static UI structure with external CDNs
- [state.js.md](./state.js.md) → Central `window.AppState` global with wide coupling across modules
- [Marker Scripts/Markers.js.md](./Marker%20Scripts/Markers.js.md) → Monolithic marker/data loader touching multiple concerns (data fetch, mapping, rendering)
- [Marker Scripts/Simulation.js.md](./Marker%20Scripts/Simulation.js.md) → Large simulation engine and UI logic combined in one file
- [User Interface/OperationalDashboard.js.md](./User%20Interface/OperationalDashboard.js.md) → Dashboard behavior tightly bound to DOM IDs and global state
- [User Interface/Sidebar.js.md](./User%20Interface/Sidebar.js.md) → Sidebar relies on global functions and DOM structure
- [User Interface/TeamSidebar.js.md](./User%20Interface/TeamSidebar.js.md) → Team management ties to tracker/task matching via string heuristics
- [src/weather/WeatherService.js.md](./src/weather/WeatherService.js.md) → Delegates caching/TTL/quota to server-owned cache; previous client/server overlap removed
- [src/weather/WeatherOverlay.js.md](./src/weather/WeatherOverlay.js.md) → Direct DOM overlay with internal state and event bus
- [src/weather/ClockManager.js.md](./src/weather/ClockManager.js.md) → Time management with assumptions on monotonic now/RAF
