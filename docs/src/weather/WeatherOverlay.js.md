# WeatherOverlay.js — File

- Name: WeatherOverlay.js
- Path: ./src/weather/WeatherOverlay.js
- Type: JavaScript (UMD/CommonJS)

## Purpose & Responsibility
Canvas-based UI overlay that renders weather visualizations and exposes controls for layers, API usage display, and clock-synchronized animations. Persists geometry and settings to storage and emits UI events.

## Internal Structure
- UMD wrapper (lines ~1–7)
- Storage helpers, math/utility functions (lines ~8–27)
- `Emitter` for local events (lines ~28–29)
- Class `WeatherOverlay` (lines ~30+)
  - Constructor accepts `service`, `clock`, `lat/lon`, `id`, `initialState`
  - `mount(parent)`: builds DOM UI; injects `weather-overlay.css` (lines ~57–141)
  - Sidebar sections: layers, OneCall API stats (lines ~90–129)
  - Footer: Clock controls (lines ~130–137)
  - Drag/resize handlers, pinning, mode/rate control (lines ~143–167, 147–158)
  - Stats polling and display updates; service event bridging (lines ~170+)

## Dependency Mapping
- Outbound: optional `WeatherService` and required `ClockManager`
- Inbound: Used by UI/Marker scripts; loaded in tests via Playwright
- External: DOM APIs; fetches server endpoints for weather stats/limits

## Line References
- CSS link injection: ~61–65
- API stats UI: ~108–129
- Drag/resize/move: ~143–158

## Bug & Risk Notes
- Direct DOM manipulation; ensure elements exist when mounting
- Storage keys per `id`; collisions possible across pages if reused

## Deletion & Cleanup Suggestions
- None