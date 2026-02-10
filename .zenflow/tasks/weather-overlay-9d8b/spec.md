**Technical Context**
- Target: Web map application with an existing Simulation Mode and map UI. This spec is framework-agnostic (works with React/Vue/vanilla) and JS/TS codebases
- Mapping: Integrate as a UI overlay on the existing map container; optional lightweight data-driven marker styling instead of paid raster tiles
- API: OpenWeather One Call 3.0 (free “One Call by Call”) endpoints
  - Current + Forecasts: `GET /data/3.0/onecall`
  - Historical (point-in-time): `GET /data/3.0/onecall/timemachine`
  - Daily Aggregation: `GET /data/3.0/onecall/day_summary`
- Environment: `OPENWEATHER_API_KEY` via secure config. For client-only apps, prefer a proxy or key scoping. Do not log the key
- Constraints: Minimize API calls (strict daily cap), add verbose structured error logging, and create a Unified Timer independent of Simulation Mode

**Implementation Approach**
- Weather Mode UX
  - A "Weather" toggle activates a map overlay panel (dashboard). The overlay floats over the map without changing map controls
  - Top-level tabs or buttons: Current, Hourly, Daily, Historical; secondary toggles: Temperature, Precipitation, Wind, Alerts
  - Within the overlay: compact current summary, small charts (spark-lines or bar charts) for hourly/daily, and a date/time picker for historical (explicit fetch on submit)
  - On-map visuals: colorize existing site/asset markers by selected metric (e.g., temperature heat using marker fill), show precipitation risk badges. Avoid paid tile layers by default
- Unified Timer
  - Implement a singleton ClockService providing a monotonic tick and channel-based schedules
  - Simulation Mode consumes (read-only) from ClockService but cannot alter its cadence or pause it
  - Consumers register named jobs with cadence and visibility guards (e.g., only run when Weather Mode is visible)
- Data Layer
  - WeatherService encapsulates OpenWeather calls with:
    - Request de-duplication by key: `{lat,lon,units,lang,blocks}` rounded to a geospatial bucket (e.g., 0.1° ~11km) to reuse data across close points
    - Response caching with per-block TTLs: current=10m; minutely=10m; hourly=30–60m; daily=2–3h; day_summary=24h; timemachine cached by exact dt
    - Coalescing multiple subscribers for the same key into one in-flight request
    - Backoff and retry (exponential with jitter) on transient 5xx; respect 429 with Retry-After if provided; never retry 400/404
    - Payload minimization using `exclude` to fetch only required blocks for the active view
  - WeatherRepository orchestrates fetching based on visible context:
    - When Weather Mode opens, fetch onecall for the map center and selected/hovered assets only
    - Historical endpoints are only called upon explicit user action (no polling). Day summary preferred for low-cost daily history, timemachine for per-hour slices when required
- Error Handling & Logging
  - Unified error shape: `{ at, op, request: {url, params}, status, code, message, bodySnippet, correlationId }`
  - Log levels: debug (request lifecycle), info (cache hits/misses), warn (degraded features), error (HTTP 4xx/5xx). Include precise timestamps and ms durations
  - User feedback: non-blocking toasts/banners with simple messages; developer console gets verbose detail
- Units & Localization
  - Respect app-wide units if present; otherwise default `metric`. Map UI shows units on legends and tooltips

**Source Code Structure Changes**
- New feature folder (illustrative paths; adapt to project conventions):
  - `src/features/weather/clock/ClockService.(ts|js)`
    - Public API: `subscribe(channel, cadenceMs, listener)`, `unsubscribe(id)`, `now()`, `isRunning()`, `start()`, `stop()`
  - `src/features/weather/api/openweatherClient.(ts|js)`
    - `request(path, params)` with base URL, key injection, query building
  - `src/features/weather/api/WeatherService.(ts|js)`
    - `getOneCall({lat,lon,units,lang,exclude})`
    - `getHistoryPoint({lat,lon,dt,units,lang})`
    - `getDaySummary({lat,lon,date,units,lang,tz?})`
    - Caching, coalescing, backoff, and error normalization
  - `src/features/weather/state/weatherStore.(ts|js)`
    - Holds UI state (mode enabled, selected metric, units), last fetched datasets, loading/error flags, cache metadata
  - `src/features/weather/ui/WeatherOverlay.(tsx|vue|jsx)`
    - Map overlay container with tabs/buttons and panels; listens to store; registers refresh jobs with ClockService
  - `src/features/weather/ui/panels/{CurrentPanel,HourlyPanel,DailyPanel,HistoricalPanel}.(tsx|vue|jsx)`
  - `src/features/weather/ui/controls/MetricToggle.(tsx|vue|jsx)`
  - `src/features/weather/map/markerStyling.(ts|js)`
    - Derives marker styles/badges from selected metric and dataset
  - `src/features/weather/logging/weatherLogger.(ts|js)`
    - Thin wrapper over app logger with context enrichment
- Existing integration points to extend (names may differ; wire in during implementation):
  - Map screen/page component: add Weather button and mount/unmount of `WeatherOverlay`
  - Global store or router: persist Weather Mode toggle across navigations if desired
  - Simulation Mode: refactor its timer to consume `ClockService` as a read-only source

**Data Model / API / Interface Changes**
- Types (simplified; TS-like for clarity)
  - `OneCall { lat, lon, timezone, timezone_offset, current?, minutely?, hourly?, daily?, alerts? }`
  - `HistoryPoint { lat, lon, timezone, timezone_offset, data: Array<CurrentLike> }`
  - `DaySummary { lat, lon, tz, date, temperature, precipitation, wind, humidity, pressure, cloud_cover }`
  - `WeatherBlocks = 'current'|'minutely'|'hourly'|'daily'|'alerts'`
- WeatherService options
  - `units: 'metric'|'imperial'|'standard'` (default metric)
  - `lang?: string`
  - `exclude?: WeatherBlocks[]`
- Caching keys
  - `cacheKey = geobucket(lat,lon,precision) + '|' + units + '|' + lang + '|' + sort(exclude)`
  - Separate internal indices for block-wise TTLs
- Scheduling
  - Channels: `weather:current` (10m), `weather:hourly` (30–60m), `weather:daily` (2–3h)
  - Jobs register/unregister on overlay open/close to avoid background usage

**Minimizing API Calls**
- Fetch only on overlay visibility and on explicit metric/tab changes
- Use `exclude` to fetch the smallest payload for the active tab
- Share onecall result across tabs when possible; never refetch until TTL expiration unless user forces refresh
- Geospatial bucketing to reuse data for nearby markers/assets
- No auto-refresh for Historical; only fetch on demand, and cache locally per `dt` or `date`
- Debounce rapid map interactions; do not refetch while panning until idle for N ms

**Verbose Error Logging**
- On every request: log start/end with timing, cache status, request key, and whether blocked by rate limit/backoff
- On HTTP error: log normalized error payload and first 512 chars of body; include parameters (excluding `appid`)
- On repeated 429: escalate to user banner with cooldown countdown; pause all weather jobs until window passes

**Verification Approach**
- Lint/Typecheck: run project’s standard scripts (e.g., `npm run lint`, `npm run typecheck`) and fix violations in new modules
- Unit tests (add alongside modules):
  - WeatherService: caching/TTL, coalescing, exclude handling, retry/backoff, 400/404 no-retry, 429 cooldown
  - ClockService: tick accuracy, subscribe/unsubscribe, multiple channels, pause/resume behavior
  - markerStyling: metric-to-style mapping boundaries and legends
- Integration tests (where framework allows):
  - WeatherOverlay toggling, data flow, and that no network requests fire when hidden
  - Historical fetch occurs only on explicit submit and respects cache
- Manual checks:
  - Open overlay: current loads once, hourly/daily only after selecting respective tabs
  - Pan/zoom map quickly: no refetch until idle threshold; nearby assets reuse same cached dataset
  - Trigger simulated 429: UI shows banner and jobs pause/resume

**Open Questions / Assumptions**
- Mapping library and state manager are unspecified; paths and component suffixes will be adapted to repository conventions
- If a server exists, prefer a small proxy for the API key; otherwise, store the key via environment config with minimal exposure
- Charting: reuse any existing lightweight chart utility; otherwise, render simple SVG sparklines to avoid adding dependencies
- If the app already has a logger, `weatherLogger` will delegate to it; otherwise, fall back to console with structured objects