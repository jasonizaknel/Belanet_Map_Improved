# Marker Scripts — Folder

- Name: Marker Scripts
- Path: ./Marker Scripts
- Type: Folder (frontend JS)

## Purpose & Responsibility
Map logic for rendering customers/towers, linking services, real-time updates, and simulation engine utilities.

## Contents Overview
- Markers.js — Data loading, mapping, link rendering, trackers, weather hooks
- Simulation.js — Playground/simulation logic, agents/routes, UI integration

## Dependency Graph
- Used by `map.html` via script tags
- Talks to backend endpoints under `/api/*`

## Risk & Cleanup
- Tight coupling to `window.AppState` globals; consider modularization in refactor
