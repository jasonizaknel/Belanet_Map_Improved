# Data — Folder

- Name: Data
- Path: ./Data
- Type: Folder (assets, inputs, generated outputs)

## Purpose & Responsibility
Holds input data files, icons for map markers, and generated reports produced by simulations and server tasks.

## Contents Overview
- Icons/ — Marker icons and images used by the UI
- reports/ — Generated simulation/usage reports (JSON)
- Other JSON/CSV/XLSX files referenced by server and UI logic

## Dependency Graph
- Referenced by frontend scripts in `Marker Scripts/Markers.js` and server-side `server.js`
- `.gitignore` excludes some Data files; treat reports as generated artifacts

## Risk & Cleanup
- `reports/*.json` and large data dumps are candidates for cleanup; ensure not required for tests

## Naming & Structural Consistency
- Consistency: mixed but generally coherent; standardize during refactor
- Case Styles: prefer kebab-case for files, camelCase for JS identifiers
- Normalization: align folder/file naming, collapse near-duplicates
- Import Paths: prefer relative paths consolidated via clear top-level entry points
