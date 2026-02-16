# tests — Folder

- Name: tests
- Path: ./tests
- Type: Folder (Playwright specs)

## Purpose & Responsibility
Holds end-to-end and unit-like Playwright tests for Weather modules and selected UI behaviors.

## Contents Overview
- weather_service.spec.js — WeatherService behavior & caching
- weather_overlay.spec.js — UI mount/geometry/persistence/legends
- clock_manager.spec.js — ClockManager tick/rate/mode logic
- other *.spec.js — Domain/UI scenarios and regression checks

## Dependency Graph
- Depends on `@playwright/test`, browser, and running `map.html` server at 5505 for some tests

## Risk & Cleanup
- Ensure network and environment variables configured before running E2E tests
