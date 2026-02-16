# ClockManager.js — File

- Name: ClockManager.js
- Path: ./src/weather/ClockManager.js
- Type: JavaScript (UMD/CommonJS)

## Purpose & Responsibility
Tick-driven clock with realtime and simulation modes, adjustable rates, hidden tab throttling, and event emission for UI synchronization.

## Internal Structure
- UMD wrapper and helpers (lines ~1–12)
- `Emitter` for events (lines ~13–35)
- Defaults: now/RAF/CAF/visibility (lines ~37–54)
- Class `ClockManager` (lines ~55–170)
  - `start/stop` scheduling (lines ~90–109)
  - `_onFrame` tick emission (lines ~110–137)
  - `setMode`, `setRate`, `setTime` (lines ~147–167)

## Dependency Mapping
- Inbound: Used by WeatherOverlay/UI to control animations
- Outbound: Uses provided RAF/CAF for portability (tests inject stubs)

## Bug & Risk Notes
- Assumes monotonic time from `now()`; ensure consistency across tests and runtime

## Deletion & Cleanup Suggestions
- None