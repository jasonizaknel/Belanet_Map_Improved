# Simulation.js — File

- Name: Simulation.js
- Path: ./Marker Scripts/Simulation.js
- Type: JavaScript (browser)

## Purpose & Responsibility
Implements Playground/Simulation features: agent management, route optimization, UI controls, scenario generators, and periodic updates synced with AppState.

## Internal Structure
- Coordinate parsing and constants (lines ~5–33)
- Color utilities and palette generation (lines ~35–66)
- UI initialization for agent customization and task dashboard (lines ~70–277)
- Simulation UI controls and sliders (lines ~279–277+)
- Rendering agent/task cards and stats (lines ~317–393 in excerpt)
- Core simulation engine sections further in file: assignment, redistribution, update loop, events, 2-opt optimization (lines ~1337, ~1398, ~1576, ~2143, ~2234 per legacy notes)

## Dependency Mapping
- Inbound: AppState, DOM structure from `map.html`
- Outbound: Uses `triggerStateChange`, interacts with `Markers.js` functions

## Bug & Risk Notes
- Long monolithic file; consider splitting engine vs UI
- Randomized elements may cause flaky visual tests

## Deletion & Cleanup Suggestions
- None