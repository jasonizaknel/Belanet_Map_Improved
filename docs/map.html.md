# map.html — File

- Name: map.html
- Path: ./map.html
- Type: HTML

## Purpose & Responsibility
Main application page hosting Google Map, sidebar UI, dashboard, and controls. Loads external libraries (Tailwind, Lucide, Animate.css), fonts, and local scripts/styles.

## Internal Structure
- Head includes Tailwind config, fonts, Animate.css, and `stylesheet.css` (lines ~5–35)
- App layout: `#app`, left `#sidebar` with tabs, `#map` container, right-side overlays (lines ~39–330)
- UI Sections: General/Towers/Customers/Tasks/Playground tabs with controls
- Weather toggle integrates with Weather Overlay features via scripts

## Dependency Mapping
- Outbound: references `stylesheet.css` and loads scripts via separate tags (runtime/injection)
- Inbound: Consumed by Playwright tests and browser navigation at `http://localhost:5505/map.html`
- External: Tailwind CDN, Lucide, Animate.css, Google Fonts

## Line References
- Tailwind config: ~15–33
- Sidebar tabs: ~54–121 (navigation), ~78–220 (content)
- Map container: ~325–326

## Bug & Risk Notes
- Heavy inline structure; script order and globals must be respected
- External CDNs introduce availability risk; consider pinning versions and local fallbacks

## Deletion & Cleanup Suggestions
- None. Future refactor could template or componentize UI to reduce static HTML bulk.

## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
