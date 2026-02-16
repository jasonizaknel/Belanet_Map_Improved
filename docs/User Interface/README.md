# User Interface — Folder

- Name: User Interface
- Path: ./User Interface
- Type: Folder (frontend JS components)

## Purpose & Responsibility
Encapsulates dashboard, sidebar, team management UI behavior detached from core map logic.

## Contents Overview
- OperationalDashboard.js — Dashboard state/render cycle, metrics, filters
- Sidebar.js — Sidebar resize/toggle, layer filters, tabs
- Searchbar.js — Debounced search integration
- TeamSidebar.js — Team roster, assignment UI, detail panel

## Dependency Graph
- Loaded by `map.html` and interacts with `window.AppState`

## Risk & Cleanup
- Heavy DOM manipulation and globals; future refactor may move to modular structure or a framework.
