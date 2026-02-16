# Root Folder — Documentation

- Name: Repository Root
- Path: ./
- Type: Folder

## Purpose & Responsibility
Holds the entire Belanet Map Improved project: Node.js server, browser UI, integration scripts, data assets, tests, and task artifacts.

## Contents Overview
- server.js — Express/WebSocket backend, integrations (Splynx, Traccar, Nagios, OpenWeather)
- map.html — Main UI shell and layout, loads scripts and styles
- src/weather — Weather overlay modules (UI + data service)
- Marker Scripts — Map logic for markers, links, simulation
- User Interface — Sidebar, dashboard, and team UI modules
- Data — Icons and generated reports/data files
- tests — Playwright specs for Weather and UI modules
- .zenflow/tasks — Task artifacts: plans/specs/reports

## Dependency Graph
- Backend serves REST + WS consumed by frontend scripts
- Frontend loads modules via UMD/global scripts in map.html
- Tests load modules directly via Playwright/node

## Risk & Cleanup
- Large binary assets and generated reports should be excluded from refactors, documented only
- Legacy `repo/` folder is superseded by `docs/` and can be considered obsolete post-docs adoption

## Naming & Structural Consistency
- Consistency: mixed but generally coherent; standardize during refactor
- Case Styles: prefer kebab-case for files, camelCase for JS identifiers
- Normalization: align folder/file naming, collapse near-duplicates
- Import Paths: prefer relative paths consolidated via clear top-level entry points
