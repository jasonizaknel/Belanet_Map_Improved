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

## CDN Pinning & Integrity
- Tailwind: pinned to `https://cdn.tailwindcss.com/3.4.1` with SRI `sha384-SOMLQz+nKv/ORIYXo3J3NrWJ33oBgGvkHlV9t8i70QVLq8ZtST9Np1gDsVUkk4xN`
- Lucide: pinned to `https://unpkg.com/lucide@0.568.0/dist/umd/lucide.min.js` with SRI `sha384-eiar3BCHV4A3ISksVAvClwS2VQfQa0LWccSYkkk2/UNldyer+2d205GVYzj65+VU`
- Animate.css: `https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css` with SRI `sha384-Gu3KVV2H9d+yA4QDpVB7VcOyhJlAVrcXd0thEjr4KznfaFPLe0xQJyonVxONa4ZC`
- All CDN tags include `crossorigin="anonymous"` to support SRI verification.

### Fallback Behavior (Operational Guidance)
- If CDNs are blocked or an integrity mismatch occurs, affected assets will not load. The page will remain functional but may render without styles (Tailwind), icons (Lucide), or animations (Animate.css).
- Operators can prefetch the exact pinned artifacts and host them behind a stable internal URL, then update `map.html` to reference those local URLs while preserving the same SRI values.
- Do not remove SRI except temporarily for emergency restoration; prefer swapping URLs to trusted, version-pinned mirrors.

## Deletion & Cleanup Suggestions
- None. Future refactor could template or componentize UI to reduce static HTML bulk.

## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
