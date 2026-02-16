# state.js — File

- Name: state.js
- Path: ./state.js
- Type: JavaScript (browser globals)

## Purpose & Responsibility
Defines global `window.AppState` for the frontend application, including data stores, visibility flags, simulation state, tracker refresh configuration, and team management. Provides `window.triggerStateChange()` helper to notify UI modules.

## Internal Structure
- Global AppState object initialization (lines ~1–124)
  - Map and marker collections, visibility defaults with localStorage persistence
  - Weather data and refresh timer control
  - Simulation config and metrics history
  - Team management sub-tree with persistence helpers
- `triggerStateChange(detail)` (lines ~126–129): dispatches `stateChanged` CustomEvent

## Dependency Mapping
- Inbound: Used by UI modules (`OperationalDashboard.js`, `Sidebar.js`, `TeamSidebar.js`, Searchbar)
- Outbound: Reads/writes localStorage keys; consumed by marker scripts and overlays

## Bug & Risk Notes
- Centralized global object increases coupling; race conditions if mutated concurrently
- LocalStorage parsing errors guarded but may still cause inconsistent state if corrupted

## Deletion & Cleanup Suggestions
- None. Consider modular state (e.g., ES modules or a small store) during refactor.

## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
