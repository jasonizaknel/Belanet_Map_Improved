# verify_markers.js — File

- Name: verify_markers.js
- Path: ./verify_markers.js
- Type: JavaScript (Node.js, Playwright)

## Purpose & Responsibility
Loads `map.html`, waits for markers to initialize, logs counts and visibility, captures a screenshot. Useful for debugging marker rendering.

## Internal Structure
- Launch headless Chromium, wait for `AppState.markersInitialized === true`, evaluate marker arrays, capture `marker_check.png` (lines ~5–40)

## Dependency Mapping
- Outbound: `playwright`

## Bug & Risk Notes
- Requires running server; timeouts may need tuning

## Deletion & Cleanup Suggestions
- Retain as utility; safe to delete if replaced by tests.
## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
