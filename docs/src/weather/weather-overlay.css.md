# weather-overlay.css — File

- Name: weather-overlay.css
- Path: ./src/weather/weather-overlay.css
- Type: CSS

## Purpose & Responsibility
Stylesheet for Weather Overlay UI, including container, header, controls, sidebar, legends, and responsive adjustments.

## Internal Structure
- Container and pinned styles (lines ~3–5)
- Header, buttons, error banners (lines ~5–14)
- Body grid, canvas wrap, sidebar (lines ~16–20)
- Toggles, inputs, footer, resize handle, badges (lines ~21–36)
- Mobile media query (line ~36)

## Dependency Mapping
- Linked by WeatherOverlay `mount()` and visible when overlay is active

## Bug & Risk Notes
- Utility classes assume Inter/system font; ensure fallback alignment with app styles

## Deletion & Cleanup Suggestions
- None
## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
