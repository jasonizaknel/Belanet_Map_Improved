# check_markers.js — File

- Name: check_markers.js
- Path: ./check_markers.js
- Type: JavaScript (Node.js, Playwright)

## Purpose & Responsibility
Automates a browser session to load `map.html`, open the dashboard, wait briefly, capture a screenshot, and log a key metric for verification.

## Internal Structure
- Launch Chromium, navigate to `http://localhost:5505/map.html`, click `#openTaskDashBtn`, wait, screenshot `dashboard_check.png`, log `#hbOpenTickets` (lines ~3–21)

## Dependency Mapping
- Outbound: `playwright`
- Inbound: Developer utility; not used in CI scripts here

## Bug & Risk Notes
- Hard-coded local URL; ensure server is running

## Deletion & Cleanup Suggestions
- Retain as a diagnostic utility; safe to remove if replaced by formal tests.
## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
