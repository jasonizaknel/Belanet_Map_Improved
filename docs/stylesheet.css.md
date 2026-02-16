# stylesheet.css — File

- Name: stylesheet.css
- Path: ./stylesheet.css
- Type: CSS

## Purpose & Responsibility
Global styles for the map application and custom UI elements not covered by Tailwind or component styles.

## Internal Structure
- Styles for layout, sidebar, dashboard, and custom controls (not analyzed in detail here)

## Dependency Mapping
- Included by `map.html`

## Bug & Risk Notes
- Inline styles in `map.html` may conflict; consolidate during refactor

## Deletion & Cleanup Suggestions
- None