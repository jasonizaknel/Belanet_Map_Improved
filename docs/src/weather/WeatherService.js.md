# WeatherService.js — File

- Name: WeatherService.js
- Path: ./src/weather/WeatherService.js
- Type: JavaScript (UMD/CommonJS)

## Purpose & Responsibility
Fetches and normalizes weather data (OpenWeather One Call 3.0 or free-tier aggregate), caches results with TTLs, exposes an evented API, and tracks API call usage with persistence.

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
- External: OpenWeather endpoints (One Call 3.0, fallback 2.5 endpoints)

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