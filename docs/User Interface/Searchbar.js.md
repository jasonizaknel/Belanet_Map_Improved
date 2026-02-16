# Searchbar.js — File

- Name: Searchbar.js
- Path: ./User Interface/Searchbar.js
- Type: JavaScript (browser)

## Purpose & Responsibility
Adds a debounced text filter to update customer marker visibility via global filter state.

## Internal Structure
- `initSearchFilter` (lines ~1–20): attaches input handler with 150ms debounce; updates `AppState.filters.query` and calls `updateCustomerMarkerVisibility`

## Dependency Mapping
- Inbound: `#searchInput` element
- Outbound: Updates `window.AppState` and calls global visibility update function

## Bug & Risk Notes
- No guard if `AppState` is missing; ensure state initialized first

## Deletion & Cleanup Suggestions
- None