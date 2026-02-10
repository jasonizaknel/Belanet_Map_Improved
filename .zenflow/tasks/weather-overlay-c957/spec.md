# Technical Specification — Real-Time Weather Overlay Dashboard (Vanilla JS + CSS)

## Technical Context
- **Language/Runtime**: Browser JavaScript (ES2019+), HTML, CSS (no framework required)
- **Build**: None required; compatible with plain `<script type="module">`. If a bundler is present, modules remain ES-compatible
- **Dependencies**: None mandatory; optional `dayjs` or similar for date formatting if already used in repo. Default to zero external deps
- **Environment/API Key**: OpenWeatherMap One Call 3.0. Key provided via one of:
  - Runtime global: `window.ENV.OPENWEATHER_API_KEY`
  - Build-time env: `import.meta.env.OPENWEATHER_API_KEY` (Vite) or `process.env.OPENWEATHER_API_KEY` (Node bundlers)
  - Direct constructor parameter to `WeatherService` (preferred explicit path)
- **Reference**: [./repo/belanet-map-improved.md](../../repo/belanet-map-improved.md) — Simulation concepts and update cadence patterns

## Functional Requirements Mapping
- **Data**: Current, hourly, daily from OpenWeather One Call 3.0; derive 3‑hour cadence by grouping 1‑hour buckets
- **Animated Layers**: Temperature, precipitation, wind, humidity, cloud cover
- **Overlay UI**: Movable, resizable, pin/unpin; toggles per-layer; responsive mini dashboard showing live now + animated short preview
- **Clocking**: Normal (real-time) and Simulation (0.5×–10×). Single active clock notifies overlay animations and preview scrubber
- **Robustness**: Error handling, backoff, cache (in-memory + optional localStorage), graceful offline

## High-Level Architecture
- **WeatherService**: API client, caching, normalization, and resampling utilities (hourly→3h). Emits fetch lifecycle events
- **ClockManager**: Dual-clock orchestrator; evented timeline with speed controls; consistent time source for animations
- **WeatherOverlay**: UI container + Canvas/SVG renderer; user interactions (drag/resize/pin/toggles); subscribes to `ClockManager` and `WeatherService`

```
[ClockManager]  ──tick(time, dt)──▶  [WeatherOverlay]
       ▲                                  │
       │                             fetch(lat,lon)
   setMode/rate                            │
       │                                  ▼
                               [WeatherService] ──cache/network──▶ OWM
```

## Module Designs

### WeatherService (src/weather/WeatherService.js)
- **Constructor**: `new WeatherService({ apiKey, baseUrl, ttl, storage })`
  - `apiKey`: required unless provided by env detection
  - `baseUrl`: default `https://api.openweathermap.org/data/3.0/onecall`
  - `ttl`: `{ currentMs: 5*60e3, hourlyMs: 15*60e3, dailyMs: 60*60e3 }`
  - `storage`: `{ type: 'memory' | 'localStorage', keyPrefix?: string }`
- **Public Methods**:
  - `fetchOneCall({ lat, lon, units = 'metric', lang = 'en', exclude = [] })` → normalized `{ current, hourly, daily, alerts, meta }`
  - `getCurrent(lat, lon, opts)` → `current`
  - `getHourly(lat, lon, opts)` → array of hours (up to 48)
  - `getDaily(lat, lon, opts)` → array of days (up to 7/8)
  - `getHourly3h(lat, lon, opts)` → resampled 3‑hour bins via average/sum rules
  - `on(event, cb)` / `off(event, cb)` → events: `request`, `response`, `error`, `cacheHit`
- **Normalization**:
  - Convert Kelvin→C/metric where applicable (use `units` param and preserve unit metadata)
  - Shape outputs to: `{ ts, tempC, tempF, feelsC, windMs, windKph, windDeg, precipMm, precipProb, humidity, clouds, icon }`
- **Caching**:
  - Key by `v1|lat|lon|units|exclude` with stamp per segment (current/hourly/daily)
  - Memory Map + optional localStorage for persistence with ISO timestamps
  - Stale-while-revalidate: return cached if fresh; kick background refresh if near-expiry
- **Errors**:
  - Network retries with backoff (e.g., 200ms, 800ms, 2000ms)
  - 401/429 surfaced distinctly; overlay shows actionable hint

### ClockManager (src/weather/ClockManager.js)
- **Modes**: `realtime`, `simulation`
- **API**:
  - `getMode()`
  - `setMode(mode)`
  - `setRate(rateNumber)` → clamp 0.5–10
  - `setSimTime(epochMs)` → set simulation anchor
  - `start()` / `stop()`
  - `getTime()` → epoch ms of active clock
  - Events: `tick({ now, dt, mode, rate })` at ~60 Hz; `mode`, `rate`, and `timeSet` events
- **Implementation**:
  - `requestAnimationFrame` loop; compute `dt` from RAF and scale by `rate` when in simulation
  - In realtime mode, `now = Date.now()` each tick; in simulation, accumulate from anchor
  - Backpressure: pause/slow ticks when tab hidden (Page Visibility)

### WeatherOverlay (src/weather/WeatherOverlay.js + src/weather/weather-overlay.css)
- **Constructor**: `new WeatherOverlay({ root, service, clock, initialState })`
  - `root`: DOM element to attach overlay (absolute-positioned container)
  - `service`: `WeatherService` instance
  - `clock`: `ClockManager` instance
  - `initialState`: `{ lat, lon, pinned, size: { w, h }, layers: { temp, precip, wind, humidity, clouds } }`
- **UI Structure**:
  - Header: location, current summary, pin/unpin, close
  - Body: canvas for animated layer preview; per-layer toggles with status pills
  - Footer: time readout (active clock), simulation controls (rate knob, mode toggle)
- **Interactions**:
  - Drag: mousedown/move on header; uses `pointer-events`
  - Resize: handle at SE corner; min/max sizes; persists last position/size
  - Pin: toggles CSS class to stick overlay; unpinned floats above map/UI
- **Rendering**:
  - Single `<canvas>` per overlay; 2D context; offscreen buffer for effects
  - Layers:
    - Temperature: color ramp gradient shifting over time; per-hour interpolation
    - Precipitation: intensity field with droplet/ripple sprites; fade based on `precipProb`/`precipMm`
    - Wind: short-lived particles advected by direction/speed; density scaled by wind speed
    - Humidity: soft fog overlay (alpha based on relative humidity)
    - Clouds: parallaxed noise textures with varying opacity
  - Animation time derived from `clock.getTime()` and layered easing
- **APIs/Events**:
  - Methods: `setLocation(lat, lon)`, `setLayers(partial)`, `setPinned(bool)`, `destroy()`
  - Events: `mounted`, `moved`, `resized`, `pinned`, `layerChange`, `error`

## Data Model (Type Hints)
```ts
// Pseudo-TS for clarity; implement in JSDoc or inline JS
export type HourPoint = {
  ts: number;            // epoch ms
  tempC: number;         // °C
  feelsC: number;        // °C
  windMs: number;        // m/s
  windDeg: number;       // 0..360
  windKph: number;       // derived
  precipMm: number;      // mm/hr
  precipProb: number;    // 0..1
  humidity: number;      // %
  clouds: number;        // %
  icon?: string;         // OWM icon id
};

export type DailyPoint = {
  ts: number;
  tempMinC: number;
  tempMaxC: number;
  humidity: number;
  clouds: number;
  windMs: number;
  precipMm: number;      // day total estimate
};
```

## OpenWeather API Notes
- Endpoint: `https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&units={units}&exclude={parts}&appid={API_KEY}`
- One Call hourly granularity is typically 1h; derive 3‑hour series by grouping [t, t+1, t+2]
  - Aggregation: temp → average; wind speed → average, wind direction → circular mean; precip → sum; clouds/humidity → average
- Consider rate limits; debounce location changes and clamp refresh to TTL

## Error Handling & Resilience
- Distinguish categories: `network`, `auth (401)`, `quota (429)`, `server (5xx)`
- UI fallback: show last known values and time since last update; muted animation state
- Retry/backoff: 0.2s, 0.8s, 2s; stop after N attempts and surface event

## Caching Strategy
- In-memory Map with value `{ data, fetchedAt }` per segment
- Optional persistent cache via `localStorage` when available; purge stale on startup
- SWR policy: serve fresh-if-young; if borderline stale, trigger background refresh and emit `response` on update

## Unified Clock & Animation Sync
- Single source of time via `ClockManager`
- Real-time mode: `rate=1`, `now=Date.now()`
- Simulation mode: adjustable rate 0.5×–10×, independent `simNow` anchor, can be reset externally
- Overlay subscribes to `tick` and interpolates between forecast points based on active time

## UI/UX & Responsiveness
- Small screens: collapse controls into icon row; canvas scales maintaining DPR with `devicePixelRatio`
- Keyboard: Esc to close, `p` to pin/unpin, `m` to toggle mode, `[`/`]` to adjust rate
- Persist user prefs (layers, pos/size, mode/rate) via `localStorage`

## Performance Considerations
- `requestAnimationFrame` loop with dynamic throttling (reduce effects density when hidden or low FPS)
- Offscreen canvas for composition; blit final frame to main canvas
- Avoid layout thrash: transform for drag/resize, not top/left when possible

## Security Notes
- Prefer passing API key via constructor or server proxy; avoid shipping secrets when possible
- If bundling client-side key, scope domain usage in OWM account and apply rate-limiting server-side when feasible

## Verification Approach
- **Manual**:
  - Configure API key and mount overlay to a sample page; verify current data shows and preview animates
  - Toggle layers, move/resize, pin/unpin; switch between realtime and simulation at various rates
- **Automated (framework-agnostic)**:
  - Unit-test `WeatherService` normalization and 3‑hour resampling with static fixtures
  - Unit-test `ClockManager` tick/rate math and mode switching
  - Snapshot/render test for `WeatherOverlay` state wiring (DOM existence, class toggles). If no test runner present, include a minimal harness HTML and console assertions
- **Lint/Typecheck**:
  - Follow repository’s existing lint command if present; otherwise ensure ESLint-compatible syntax and JSDoc types

## Source Structure (proposed)
- `src/weather/WeatherService.js`
- `src/weather/ClockManager.js`
- `src/weather/WeatherOverlay.js`
- `src/weather/weather-overlay.css`
- `public/weather-demo.html` (optional demo harness)

## Predictive Overlay Enhancements (Suggestions)
- Temporal interpolation using cubic easing between forecast steps for smoother transitions
- Wind particle system seeded by Perlin noise to avoid repetitive patterns; density tied to Beaufort scale
- Precipitation morph with directional streaks based on windDeg and speed; switch to snowflakes under temp threshold
- Temperature ramp with diurnal cycle bias to mimic sunrise/sunset warming/cooling
- Cloud layer with multi-octave noise and subtle parallax to imply altitude strata
- Confidence visualization: reduce saturation/alpha further in the future to communicate uncertainty
