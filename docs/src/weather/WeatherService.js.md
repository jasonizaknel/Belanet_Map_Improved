# WeatherService.js — File

- Name: WeatherService.js
- Path: ./src/weather/WeatherService.js
- Type: JavaScript (UMD/CommonJS)

## Purpose & Responsibility
Fetches and normalizes weather data (OpenWeather One Call 3.0 or free-tier aggregate). Delegates caching, TTLs, and quota enforcement to the server-owned cache by default (via `/api/onecall`), exposes an evented API, maintains an advisory client cache for UI responsiveness, and synchronizes API usage from server-provided headers.

## Internal Structure
- UMD wrapper and defaults (lines ~1–9)
- Helpers: storage, emitter, math, JSON parsing (lines ~10–89)
- Normalizers: `normalizeCurrent`, `normalizeHourly`, `normalizeDaily` (lines ~90–167)
- Resampling utilities: 3h buckets and aggregations (lines ~169–217)
- Class WeatherService (lines ~219–325+)
  - Ctor options: apiKey, baseUrl, ttl, storage, units, lang, fetcher
  - Event API: `on/off`
  - API usage counters: get/set/limit, events for changes
  - Storage of counters via `_saveApiCallStats/_loadApiCallStats`
  - `_requestJson` with retry/backoff and categorized errors (lines ~327–370)
  - URL composition and free-tier fallback aggregator (lines ~372–400)
  - High-level fetch methods (not shown in excerpt) wrapping normalization and caching

## Dependency Mapping
- Outbound: Relies on a `fetch`-compatible function and browser/localStorage-like storage
- Inbound: Used by `WeatherOverlay.js` and indirectly via Marker scripts
- External: Defaults to server `/api/onecall` (server-owned cache). Optionally calls OpenWeather endpoints directly when configured (One Call 3.0, fallback 2.5/aggregate).

## Line References
- Constructor: ~219–251
- `_requestJson`: ~327–370
- 3h resampling: ~174–217

## Bug & Risk Notes
- Assumes presence of `fetch`; in Node contexts needs explicit injection
- Storage exceptions swallowed by design; may hide persistence failures
- Rate-limit handling emits events; callers must subscribe for UX

## Deletion & Cleanup Suggestions
- None
## Refactor Notes
- Server-owned cache: Defaults to server base `/api/onecall`; TTL and quota enforcement are centralized on the server. Client cache is advisory-only to improve UX and avoid UI stalls.
- Quota centralization: API usage counters are synchronized from `X-Weather-Quota-Used` and `X-Weather-Quota-Limit` headers when hitting the server. Local counters are only incremented when calling OpenWeather directly.
- Metadata propagation: All methods return `_meta` from the server (`ts`, `stale`, `source`, and TTL hints) to inform UI about freshness and cache behavior.
- Removed client responsibilities: Client no longer enforces hard rate limits when using server base; backoff/retry is retained for robustness.
