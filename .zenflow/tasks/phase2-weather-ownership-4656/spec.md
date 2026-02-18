# Technical Specification — Phase 2: Server‑Owned Weather Cache

## Technical Context
- **Runtime**: Node.js (Express server), browser (UMD modules)
- **Key Modules**:
  - Server: `services/WeatherBackend.js`, `server.js`
  - Client: `src/weather/WeatherService.js`, `src/weather/WeatherOverlay.js`
  - Utilities: `lib/cache` (LRU TTL), `lib/metrics`, `lib/logger`
- **External API**: OpenWeather One Call 3.0
- **Current Duplication**:
  - Client maintains its own cache, TTLs, and quota counters
  - Server also maintains caches (global and per‑coordinate) and quota tracking

## Goals
1) Server‑owned cache centralizes TTLs, quotas, and statistics
2) Client delegates quota and TTL enforcement to server; client caching becomes advisory only
3) Remove duplication between server/client caches while preserving backward‑compatible APIs
4) Update modules and tests to reference server cache and validate consistency and telemetry

## Implementation Approach

### A. Server Weather Cache Centralization
- **Unify caches in `WeatherBackend`**
  - Replace ad‑hoc `coordCache`/`cache` structures with `LruTtlCache` instances
    - `coordCache`: keyed by `lat,lon` bucket (rounded precision), TTL = `coordTtlMs`
    - `globalCache` (optional): single key for default map view, TTL = `cacheTtlMs`
  - Store and return `_meta` alongside payload:
    - `{ cache: 'server', hit: boolean, stale: boolean, ts: number, ttl_ms: number, quota: { used, limit }, source: 'openweather' }`
- **Quota accounting**
  - Keep a single counter set in `WeatherBackend` (`callsUsed`, `callLimit`, `startTime`, `resetTime`)
  - Enforce quota in `oneCall()` before performing upstream request (429 on exceed)
  - Persist stats to `Data/weather-api-stats.json` (already present)
- **TTL policy**
  - Honor `coordTtlMs` per coordinate; reject/fallback if upstream fails
  - When serving cached data beyond TTL and upstream fails, return last good with `_meta.stale = true`
- **Telemetry & Logging**
  - Metrics: `weather_cache_hit_total`, `weather_cache_miss_total`, `weather_quota_enforced_total`
    - Or reuse existing `inc('cache_hit'|'cache_miss', { cache: 'weather' })` with added labels `{ level: 'coord'|'global' }`
  - Log structured events: `weather.cache.hit/miss`, `weather.quota.reached`, `weather.fetch.success/error`

### B. Server Routes & Backward Compatibility
- **Routes (unchanged paths)**
  - `GET /api/weather` → returns default aggregated data
  - `GET /api/onecall?lat&lon` → returns One Call 3.0 payload for bucketed coord
  - `GET /api/weather/stats`, `POST /api/weather/stats/limit`, `POST /api/weather/stats/reset`
- **Response shape**
  - Preserve current One Call fields; append `_meta` (non‑breaking)
  - Optionally include cache headers: `Cache-Control: private, max-age=NN`, `X-Weather-Quota-Used`, `X-Weather-Quota-Limit`
- **Cleanup in `server.js`**
  - Remove legacy `weatherCache` and `coordWeatherCache` in favor of `WeatherBackend`
  - Ensure all weather endpoints call the backend only; centralize metrics there

### C. Client Delegation & Backward Compatibility
- **WeatherService**
  - Default `baseUrl` to `/api/onecall` when `baseUrl` not explicitly set and running in browser (server present)
  - Keep normalization/utilities, but treat client cache as advisory
    - Maintain short in‑memory cache to avoid UI flicker; mark `_meta.source = 'server'` when hitting server
  - Deprecate internal quota counters for enforcement purposes; instead expose read‑only view by polling `/api/weather/stats`
  - Continue emitting existing events (`cache_hit/miss`, `revalidate_*`) for UI, mapped from server responses
- **WeatherOverlay**
  - Use `/api/weather/stats` for display; limit/reset actions remain server‑backed
  - Avoid mutating client `WeatherService` quota; if present, keep for backward‑compatible UI only

### D. Module Updates
- Search for all consumers of `WeatherService` and update call sites to allow server default base
- Ensure any direct OpenWeather calls in the UI are removed or gated behind explicit configuration
- Validate no other module maintains a parallel weather cache

## Source Code Changes

- `services/WeatherBackend.js`
  - Replace `coordCache` Map with `new LruTtlCache({ name: 'weather_coord', ttlMs: coordTtlMs, maxSize: 512 })`
  - Add `_meta` to returned objects; increment telemetry for hit/miss/quota
  - Ensure quota enforcement precedes upstream fetch; persist stats on every mutation
- `server.js`
  - Remove unused `weatherCache`, `coordWeatherCache`
  - Ensure `/api/weather` and `/api/onecall` always delegate to `WeatherBackend`
  - Add cache headers and pass through `_meta`
- `src/weather/WeatherService.js`
  - Change default `baseUrl` to `/api/onecall` when available; keep option to force OpenWeather for tests
  - Retain normalization and 3h resampling; mark `_meta.source = 'server'|'cache'`
  - Make quota setters no‑ops for enforcement; provide optional `syncServerStats()` utility
- `src/weather/WeatherOverlay.js`
  - Read usage stats from server; keep UI minimal changes
  - If present, still forward limit/reset to `WeatherService` for compatibility
- Tests
  - Add `tests/weather_backend.spec.js` to cover TTL, hits/misses, stale return, quota 429, multi‑client consistency
  - Update `tests/weather_service.spec.js` to focus on normalization and metadata passthrough when `baseUrl` is server
  - Keep UI tests unchanged; they already call server stats endpoints

## Data Model / API / Interface Changes
- No breaking changes to public endpoints or client method signatures
- Responses gain a `_meta` object:
  - `source: 'server'|'cache'|'network'`, `cache: 'server'|'client'`, `hit: boolean`, `stale: boolean`, `ts: number`, `ttl_ms: number`, `quota: { used, limit }`
- Optional HTTP headers for cache/quota visibility

## Verification Approach

1) Unit Tests
   - WeatherBackend: cache hit/miss, TTL expiry, stale‑while‑revalidate behavior, quota enforcement (429), stats persistence
2) API Contract
   - `/api/onecall` returns One Call data plus `_meta`; multiple requests for same bucket hit cache until TTL
3) Client Behavior
   - WeatherService normalization unchanged; when pointing to server base, `_meta.source = 'server'` and no client TTL enforcement
4) E2E/Integration
   - Multiple concurrent clients requesting the same coords see consistent data and decreasing server quota
   - WeatherOverlay displays server stats and limit/reset updates correctly
5) Telemetry/Logging
   - Metrics counters increment for hits/misses/quota; logs contain structured events

## Risks & Mitigations
- Risk: Breaking UI/tests expecting client TTL behavior → Mitigation: keep advisory cache and update tests to validate server‑owned TTL
- Risk: Over‑eager cache invalidation under heavy concurrency → Mitigation: bucket coords, lock per key during revalidation
- Risk: Mixed sources during migration → Mitigation: default client to server base; require explicit opt‑in to direct OpenWeather

