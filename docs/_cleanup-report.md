# Cleanup Report

## Suspected Duplication Clusters
- Weather fetching and caching logic
  - Client: `src/weather/WeatherService.js` (caching/TTL, retries likely at client layer)
  - Server: `server.js` (`weatherCache`, `coordWeatherCache`, OneCall API usage and persistence)
  - Note: Consider consolidating retry/TTL ownership [REQUIRES-REFACTOR]
- Host listing utilities
  - `list_hosts.js` vs `list_hosts_v2.js` appear to target similar outputs with differing logic paths [REQUIRES-REFACTOR]
- Marker verification utilities
  - `verify_markers.js` vs `check_markers.js` both validate marker/link integrity with overlapping responsibilities [REQUIRES-REFACTOR]
- Nagios datasets
  - `nagios_hosts.txt` vs `nagios_hosts_new.txt` look like versioned snapshots of similar data [ARCHIVAL]
- Dashboard features and tests
  - `tests/dashboard_grid_assignment.spec.js`, `tests/dashboard_v3_improvements.spec.js`, `tests/operational_dashboard_v2.spec.js`, `tests/ops_dashboard_fixes.spec.js` cover overlapping UI flows; underlying UI code appears split across `OperationalDashboard.js`, `Sidebar.js`, `TeamSidebar.js` [REQUIRES-REFACTOR]
- Weather UI validation tests
  - `tests/weather_layer_screens.spec.js`, `tests/weather_overlay.spec.js`, `tests/weather_service.spec.js`, `tests/weather_tiles_e2e.spec.js` share scenarios across overlay/service; may benefit from shared fixtures/utilities [REQUIRES-REFACTOR]
- Simulation logic vs live tracker handling
  - `Marker Scripts/Simulation.js` and tracker management in `Markers.js` both update map state and polylines; ensure responsibilities are cleanly separated [REQUIRES-REFACTOR]
