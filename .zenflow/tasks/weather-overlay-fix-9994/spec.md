# Weather Overlay – Technical Specification

## Complexity
- **Level**: hard
- **Rationale**: Cross-cutting fixes across UI state, persisted state, overlay rendering, Google Maps tile layers, API migration to One Call 3.0, and API call optimization. Requires coordinated updates to multiple modules and E2E verification.

## Technical Context
- **Language/Stack**: Vanilla JavaScript + CSS (browser) and Node.js (Express server)
- **Key Modules**:
  - Client:
    - [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js)
    - [./src/weather/weather-overlay.css](./src/weather/weather-overlay.css)
    - [./src/weather/WeatherService.js](./src/weather/WeatherService.js)
    - [./User Interface/Sidebar.js](./User%20Interface/Sidebar.js)
    - [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js)
    - [./map.html](./map.html)
  - Server:
    - [./server.js](./server.js)
  - Reference notes:
    - [./repo/belanet-map-improved.md](./repo/belanet-map-improved.md)

## Findings (Current State)
- **Conflicting Weather toggle handlers**
  - `#toggleWeatherBtn` is wired in both [./User Interface/Sidebar.js](./User%20Interface/Sidebar.js:95) and [./map.html](./map.html:810). The map.html handler mounts/hides `WeatherOverlay` independent of `AppState.visibility.weather`, causing inverted or desynced states.
- **Multiple close paths for overlay**
  - [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js:79) adds a header close button that sets `display: none`.
  - [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js:156) hides overlay on `Escape`. These bypass the main Weather button state.
- **Clock embedded in overlay**
  - Overlay footer contains clock controls and time ([./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js:107–115,172–176)).
- **Resize/UI jitter**
  - Inline sizing subtracts 2px and sets width/height via element box metrics ([./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js:70–71,141–143,124–127)), which can cause layout jitter and off-by-ones. CSS lacks explicit `box-sizing` on root and `min-width:0` safeguards on grid children.
- **Tile layers limited**
  - [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js:469–483) always loads `clouds_new` only. Other layers (precipitation, rain, snow, temp, wind, pressure) are missing.
- **API usage split/inconsistent**
  - Client overlay uses One Call 3.0 by default ([./src/weather/WeatherService.js:8](./src/weather/WeatherService.js:8), `data/3.0/onecall`) with strong caching and backoff.
  - Server `/api/weather` still uses 2.5 endpoints ([./server.js:355–393](./server.js:355)).
- **Potentially redundant refreshes**
  - Weather tiles toggle via `AppState.visibility.weather` and periodic `/api/weather` refresh ([./Marker Scripts/Markers.js:215–236](./Marker%20Scripts/Markers.js:215)). Overlay fetches separately on mount with caching. Toggling should not cause new One Call calls for the same lat/lon within TTL.

## Goals & Acceptance
1) **Single source of truth**: The Map Overlay “Weather” button controls open/close. No internal close in the overlay. Button state always matches rendered state. Persisted visibility normalizes on load.
2) **Stable resize**: No jitter/overflow; position persists; CSS-first layout.
3) **One Call 3.0 everywhere**: Remove old 2.5 fallbacks/assumptions; validate parameters.
4) **Missing layers**: Enable precipitation, rain, snow, temp, wind, pressure, clouds tiles using correct layer keys per Weather Maps 1.0/2.0 docs.
5) **API optimization**: Cache and share data, avoid re-fetch on toggles; respect 1000/day budget.

## Implementation Approach

### A. Overlay State & Control Logic
- **Centralize control in one handler**
  - Remove the extra `#toggleWeatherBtn` listener in [./map.html](./map.html:810) and delegate to a single `toggleWeather()` controller in [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js:1379).
  - Extend `toggleWeather()` to manage `WeatherOverlay` mount/destroy or show/hide so button state and overlay state remain synchronized.
- **Normalize persisted visibility**
  - On app init (after `initMap`), read `AppState.visibility.weather` and:
    - If active: mount/show `WeatherOverlay` and attach tile layers.
    - If inactive: ensure overlay is unmounted/hidden and tiles removed.
- **Remove internal close paths**
  - Delete the close button creation/binding and Escape-to-hide in [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js:79,156). Overlay should only be closed by the Weather button.
- **Clock**
  - Remove clock UI from overlay footer ([./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js:107–115,172–176)). Add a minimal, fixed bottom-right clock element in [./map.html](./map.html) with small CSS, driven by `ClockManager` or native `Date`.

### B. UI Resizing & Layout
- **CSS-first stabilization** in [./src/weather/weather-overlay.css](./src/weather/weather-overlay.css):
  - Add `box-sizing: border-box` to `.weather-overlay`.
  - Ensure grid children use `min-width: 0; min-height: 0;` for proper overflow behavior.
  - Keep `min-width`/`min-height`; avoid layout shifts.
- **JS adjustments** in [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js):
  - Stop subtracting 2px when restoring persisted width/height.
  - Keep position intact on resize; throttle `onResize` updates if needed.
  - Ensure canvas resizes with DPR safely without causing container reflow.

### C. One Call API 3.0 Everywhere
- **Client**
  - Continue using `https://api.openweathermap.org/data/3.0/onecall` with `units` and `lang`. Remove legacy free-plan fallback paths from runtime (e.g., `_fetchFreeTierAggregate()` avoidance).
- **Server** ([./server.js](./server.js))
  - Replace 2.5 calls with One Call 3.0: `https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&units=metric&appid=...` with `exclude=minutely,alerts` by default.
  - Maintain cache with a TTL (10–15 min) and return cached data to clients using `/api/weather`.

### D. Weather Tile Layers (OpenWeather Maps)
- **Enable multiple layers** in [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js:439–483):
  - Supported layer keys per docs: `clouds_new`, `precipitation_new`, `rain_new`, `snow_new`, `temp_new`, `wind_new`, `pressure_new`.
  - Allow pushing more than one `ImageMapType`; manage removal safely from `overlayMapTypes`.
  - Consider simple selection via `AppState.weather.selectedLayers` defaulting to `["clouds_new","precipitation_new","temp_new"]`.
- **Docs**
  - Weather Maps 1.0 tiles: `https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid={API key}`.

### E. API Call Optimization (≤ 1000/day)
- **Reuse & TTLs**
  - Client `WeatherService`: keep TTL defaults (`current: 5m`, `hourly: 10m`, `daily: 60m`), cache in-memory + localStorage, background revalidation.
  - Server `/api/weather`: 10–15m TTL; do not refetch on every toggle.
- **Avoid duplicates**
  - `toggleWeather()` must not trigger any One Call fetch directly; overlay/service handles caching; tiles are static images not counted in One Call quota.
  - Share last-known location for One Call between overlay and server when practical; do not coordinate extra network calls on mere visibility flips.

## Source Changes (Planned)
- **Client**
  - [./map.html](./map.html): remove extra `#toggleWeatherBtn` handler; add fixed clock container and minimal styles.
  - [./User Interface/Sidebar.js](./User%20Interface/Sidebar.js): no change to button wiring; ensure it delegates to a single `toggleWeather()`.
  - [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js):
    - Enhance `toggleWeather()` to manage `WeatherOverlay` lifecycle + tiles.
    - Extend `updateWeatherLayers()` to support multiple layers; read from config/state.
  - [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js):
    - Remove internal close button and Esc-hide.
    - Remove clock UI and related bindings.
    - Tweak mount/resize logic to remove width/height -2px and stabilize rendering.
  - [./src/weather/weather-overlay.css](./src/weather/weather-overlay.css):
    - Add `box-sizing: border-box` and grid overflow guards; ensure smooth resize.
- **Server**
  - [./server.js](./server.js): migrate `/api/weather` to One Call 3.0 with cache; remove 2.5 endpoints.

## Data / API / Interface Changes
- **One Call 3.0 request**
  - `GET https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&units=metric&exclude=minutely,alerts&appid={API key}`
- **Weather Tiles**
  - `GET https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid={API key}` where `{layer} ∈ {clouds_new, precipitation_new, rain_new, snow_new, temp_new, wind_new, pressure_new}`
- **ENV / Config**
  - Requires `OPENWEATHER_API_KEY` and `GOOGLE_MAPS_KEY` for E2E. Tests must request these from the user before running.

## Verification Approach
- **Unit / Integration**
  - Existing tests:
    - [./tests/weather_service.spec.js](./tests/weather_service.spec.js): Keep passing; adjust if One Call changes require minor normalization tweaks.
    - [./tests/weather_overlay.spec.js](./tests/weather_overlay.spec.js): Update to reflect removal of internal close/clock if applicable; add assertions for mount/show via single toggle.
- **E2E (Playwright)**
  - Precondition: collect `OPENWEATHER_API_KEY` and `GOOGLE_MAPS_KEY` from user.
  - Start server and visit `/map.html`.
  - Validate:
    - Toggling Weather button shows/hides overlay and keeps button’s active class in sync.
    - No internal close in overlay; `Esc` does not hide it.
    - Resize overlay smoothly; no jitter/overflow; position persists.
    - Tile layers load for `clouds_new`, `precipitation_new`, `temp_new`, `rain_new`, `snow_new` when enabled; capture screenshots.
    - API call counts within budget under typical flow (spot-check via request logs).

## Risks & Mitigations
- **Dual control paths**: Remove duplicate listeners; centralize control.
- **Visual regressions**: Scope CSS changes narrowly to `.weather-overlay*` classes; verify on mobile width.
- **API rate**: Respect TTLs; avoid fetch-on-toggle semantics.

## Notes
- Follow existing patterns documented in [./repo/belanet-map-improved.md](./repo/belanet-map-improved.md) for map overlays and initialization.
- Do not add new libraries.
