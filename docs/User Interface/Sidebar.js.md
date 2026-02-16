# Sidebar.js — File

- Name: Sidebar.js
- Path: ./User Interface/Sidebar.js
- Type: JavaScript (browser)

## Purpose & Responsibility
Implements left sidebar behaviors: drag-to-resize, collapse/expand, layer filter toggles, and tab switching.

## Internal Structure
- `initSidebarResize` (lines ~1–34): mousedown/move/up listeners to adjust width
- `initSidebarToggle` (lines ~36–52): toggles `collapsed` state and button position
- `initFilterButtons` (lines ~54–101): binds buttons for customers, towers, links, trackers, weather
- `initTabs` (lines ~103–131): toggles active tab buttons and panels
- DOMContentLoaded initializer (lines ~133–141)

## Dependency Mapping
- Inbound: HTML IDs/classes in `map.html`
- Outbound: Calls global functions like `toggleCustomers`, `toggleTowers`, `toggleLinks`, `toggleTrackers`, `toggleWeather`

## Bug & Risk Notes
- Assumes presence of global functions; refactor to importable modules would improve reliability

## Deletion & Cleanup Suggestions
- None
## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
