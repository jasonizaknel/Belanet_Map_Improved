# OperationalDashboard.js — File

- Name: OperationalDashboard.js
- Path: ./User Interface/OperationalDashboard.js
- Type: JavaScript (browser)

## Purpose & Responsibility
Coordinates the Operational Dashboard UI lifecycle: listens to state changes, binds controls, applies filters/sorting, updates metrics, and triggers optimization flows. Interacts with simulation and live data through AppState.

## Internal Structure
- DOMContentLoaded bootstrap and event bindings (lines ~7–49)
- Toggle strategy panel and optimization controls (lines ~50–83)
- Work speed and shorten-time handlers (lines ~84–103)
- Search and grid view toggles (lines ~105–120)
- Persistent filters init/persist (lines ~121–169)
- Metric filter shortcuts (lines ~170–216)
- AppState UI defaults (lines ~217–222)
- SLA config controls with persistence (lines ~224–247)
- Grid columns slider, density toggle, selection and bulk assignment (lines ~249–343)
- Main `updateOperationalDashboard` and related helpers (beyond excerpt ~346+)

## Dependency Mapping
- Inbound: `window.AppState`, `map.html` elements
- Outbound: Uses localStorage, optional `fetch` for subsequent refreshes

## Bug & Risk Notes
- Heavy reliance on IDs/classes in HTML; fragile if DOM changes
- Globals and side effects make unit testing harder; covered by E2E specs

## Deletion & Cleanup Suggestions
- None