# src/weather — Folder

- Name: weather
- Path: ./src/weather
- Type: Folder (frontend JS/CSS)

## Purpose & Responsibility
Implements a self-contained Weather Overlay: UI component, data service for OpenWeather, and a tick-based clock manager for simulations.

## Contents Overview
- WeatherService.js — Data layer, caching, retry/backoff, API usage counters
- WeatherOverlay.js — UI overlay with layers, controls, legends, and canvas rendering
- ClockManager.js — Realtime/simulation clock with tick events
- weather-overlay.css — Styles for the overlay

## Dependency Graph
- Consumed by `map.html` and Marker scripts; communicates with backend `/api/weather/*`

## Risk & Cleanup
- UMD patterns and globals; consider ES module migration in refactor.