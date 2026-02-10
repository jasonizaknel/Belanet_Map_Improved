# Weather Overlay Implementation Report

## What Was Implemented
- Added a unified timer integration for Simulation by wiring it to the global `ClockService` when available, without allowing Simulation to influence the global clock
  - Replaced internal `setInterval` loops with `Clock.subscribe` for simulation updates and marker indicator updates, with graceful fallback to `setInterval` if `Clock` is not present
  - Ensured proper cleanup using `Clock.unsubscribe` and clearing intervals on simulation stop and mode switches
- Optimized Weather Mode API usage to respect free plan limits
  - Stopped background weather polling that duplicated overlay requests by removing `startWeatherRefresh/stopWeatherRefresh` from the Weather toggle
  - Gated OpenWeather tile layers behind a config flag (`AppConfig.features.weatherTiles === true`) to avoid high-volume tile requests by default
- Verified and retained structured error logging
  - Client overlay requests log structured fetch status and durations
  - Server weather proxy endpoints (`/api/weather/onecall`, `/timemachine`, `/day_summary`) include verbose, structured error logs with status and body snippets
- Preserved existing Weather Overlay UI with tabs (Current, Hourly, Daily, Historical), metric toggles, unit selection, and on-demand historical fetch

## Files Changed
- Belanet_Map_Improved/Marker Scripts/Simulation.js
  - Introduced `simClockSubId` and `markerClockSubId`
  - Switched simulation and marker update loops to use `Clock.subscribe` when present; added comprehensive cleanup
- Belanet_Map_Improved/Marker Scripts/Markers.js
  - Removed duplicate background fetch (`startWeatherRefresh/stopWeatherRefresh`) from `toggleWeather()`
  - Updated `updateWeatherLayers()` to require `AppConfig.features.weatherTiles === true` before adding OpenWeather tile overlays

## How It Was Tested
- Manual reasoning-level verification of code paths:
  - Opening Weather Mode triggers the overlay; overlay fetches via `/api/weather/onecall` with `exclude` tuned to the active tab
  - Weather toggle no longer triggers extra `/api/weather` polling, reducing API usage
  - If `AppConfig.features.weatherTiles` is not explicitly set to true, no OpenWeather tile layers are added (and any existing ones are removed), minimizing tile requests
  - Starting/stopping Simulation subscribes/unsubscribes to the unified `ClockService` correctly; fallbacks remain in place

## Notable Considerations
- The overlay already caches responses in-memory per-URL and the server proxies add TTL caches per endpoint to further minimize calls
- If needed, enabling weather tiles intentionally can be done by serving `features.weatherTiles: true` from `/api/config`
- No new dependencies or environment variables were introduced; `OPENWEATHER_API_KEY` remains the only requirement for weather features