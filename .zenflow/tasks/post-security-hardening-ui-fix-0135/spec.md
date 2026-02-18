# Technical Specification — Post Security Hardening UI Fix

## Complexity
- Medium: Multiple intertwined concerns (Tailwind loading, CSS order, layout contracts) with high risk of regressions across the Operations Dashboard overlay. No bundlers or major refactors allowed.

## Technical Context
- Frontend: Single-page `map.html` served statically by Express (`server.js`)
- UI Stack:
  - Tailwind CSS via CDN runtime (pinned): `<script src="https://cdn.tailwindcss.com/3.4.1" integrity="...">` with inline `tailwind.config` block
  - Lucide UMD, Animate.css via CDN
  - Global styles in [./stylesheet.css](./stylesheet.css)
  - Weather overlay CSS loaded dynamically at runtime from [./src/weather/weather-overlay.css](./src/weather/weather-overlay.css) by [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js)
- Operations Dashboard markup and behavior live in [./map.html](./map.html) and [./User Interface/OperationalDashboard.js](./User%20Interface/OperationalDashboard.js)
- Tests: Playwright specs in `tests/*.spec.js`

Observations:
- `stylesheet.css` defines a subset of Tailwind-like utilities (e.g., `.flex`, `.flex-col`, `.flex-1`, `.hidden`, `.bg-white`) which can collide with Tailwind utilities. Because `stylesheet.css` loads after the Tailwind CDN `<script>`, it overrides same-specificity utilities.
- Dashboard uses Tailwind utilities extensively, but `OperationalDashboard.js` also applies critical layout styles imperatively (e.g., sets `display: grid` and `gridTemplateColumns` on `#dashTaskList`). This reduces, but doesn’t eliminate, dependency on Tailwind.

## Root Cause Hypotheses To Validate (Phase 1)
1) Tailwind blocked or missing after security changes (CSP/SRI/CDN). Symptom: classes like `min-h-[500px]` or `gap-6` have no effect → collapsed/stacked layout.
2) CSS load order drift in `<head>` of `map.html` (e.g., `stylesheet.css` moved before Tailwind, or Tailwind loaded more than once), changing cascade and preflight effects.
3) Broken layout contracts: parents missing `display:flex/grid` or height context (`100vh`/`h-full`), especially for the Dashboard overlay and sidebar containers.
4) Tailwind Preflight overriding element defaults counted on by dashboard (inputs, headings), requiring targeted re-scoping.

## Implementation Approach

### 1) Tailwind Load Verification and Pinning
- Keep Tailwind pinned to `3.4.1` with SRI and `crossorigin`.
- Ensure it loads exactly once and runs before app CSS.
- Runtime guard: detect effective Tailwind application and warn if missing; apply a safe fallback class to enable CSS fallbacks.

Proposed additions:
- In [./map.html](./map.html):
  - Keep order: Tailwind CDN script → plugin/extension CSS (none) → `stylesheet.css` → component-specific/dynamic CSS (Weather overlay is injected later).
  - Add a short inline comment near CSS/script tags documenting the required order.
- In [./User Interface/OperationalDashboard.js](./User%20Interface/OperationalDashboard.js):
  - Add an early check that asserts a Tailwind-only arbitrary utility resolves. If it fails, add `tw-missing` to `document.documentElement` and `console.warn` with a remediation hint.

Detection snippet (illustrative):
```js
function ensureTailwindActive() {
  try {
    const el = document.createElement('div');
    el.className = 'min-h-[500px]'; // requires CDN JIT
    document.body.appendChild(el);
    const ok = getComputedStyle(el).minHeight === '500px';
    el.remove();
    if (!ok) document.documentElement.classList.add('tw-missing');
    return ok;
  } catch { document.documentElement.classList.add('tw-missing'); return false; }
}
```
- Call `ensureTailwindActive()` in the existing `DOMContentLoaded` init prior to layout updates.

### 2) CSS Load Order and Scoped Overrides
- Keep `stylesheet.css` after Tailwind so app overrides win, but scope Operations Dashboard overrides to avoid global leakage and Tailwind utility collisions.
- Add a small, scoped fallback block inside `stylesheet.css` to preserve dashboard layout if Tailwind is missing or preflight differs.

Scoped fallback rules (within `stylesheet.css`):
```css
/* Applied only when Tailwind is missing */
.tw-missing #taskDashboard { position: fixed; inset: 0; display: flex; flex-direction: column; }
.tw-missing #taskDashboard > .header-bar { flex: 0 0 auto; }
.tw-missing #taskDashboard .dashboard-main { flex: 1 1 auto; overflow: hidden; display: flex; gap: 24px; }
.tw-missing #dashTaskList { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; align-content: start; }
```
- Also add non-intrusive, ID-scoped layout contracts that do not depend on utilities, e.g.,
```css
#app { display: flex; height: 100vh; width: 100%; overflow: hidden; position: relative; }
#taskDashboard { /* overlay is full-viewport; Tailwind or not */ }
```
- Ensure no global utility names are overridden beyond what already exists; prefer ID- and component-scoped selectors.

### 3) Restore Explicit Layout Contracts
- Verify and enforce for dashboard containers:
  - Overlay root: fixed + inset-0 + flex column + header fixed height + main flex-1 with `min-height: 0` to allow inner scroll.
  - Lists/panels: explicit `overflow-y: auto` and `min-width: 0` on flex/grid children to prevent unintended overflow/stacking.
- Where runtime JS already applies `display:grid` and `gridTemplateColumns`, keep this logic as the source of truth; complement with CSS fallbacks for the non-grid (list) mode.

### 4) Tailwind Compatibility Normalization
- Replace fragile usage patterns where needed during implementation:
  - Avoid `h-full` unless parent establishes height; use `100vh` on roots, `min-h-0` on flex children (many already present).
  - Ensure any `gap-*`/`space-*` are only on flex/grid containers.
- Do not introduce new design; only normalize utilities to version-safe ones compatible with 3.4.x.

### 5) Defensive Runtime Guards
- Add console warnings if:
  - Tailwind not detected (`tw-missing` applied)
  - `#taskDashboard` computed height is `0` after open
  - Expected container classes are missing when opening the dashboard
- Prefer visible, recoverable failure modes rather than silent breakage.

## Source Code Changes
- Modify:
  - [./map.html](./map.html)
    - Confirm/adjust head order: Tailwind CDN script, optional Tailwind plugin CSS (none), [./stylesheet.css](./stylesheet.css)
    - Add a brief inline comment explaining that order is required for deterministic cascade and Preflight placement
  - [./stylesheet.css](./stylesheet.css)
    - Add ID-scoped layout contracts for the dashboard root and primary containers (no redesign)
    - Add `.tw-missing` fallbacks for core dashboard layout (grid/list containers, main area)
    - Ensure no global utility collisions beyond what already exists
  - [./User Interface/OperationalDashboard.js](./User%20Interface/OperationalDashboard.js)
    - Add `ensureTailwindActive()` check and `tw-missing` toggle during init
    - Add small guards that warn when root has zero height or when opening without required containers

- No new files are required; changes remain within existing files.

## Data Model / API / Interface Changes
- None. No backend or data contract changes.

## Verification Approach

1) Manual Browser Checks
- Open [./map.html](./map.html) served by `node server.js` (defaults to Express static root)
- Verify in DevTools:
  - Tailwind loads once: a single Tailwind `<style>` tag injected by the CDN script; `window.tailwind` defined
  - CSS order: Tailwind first, then `stylesheet.css`, then dynamic weather overlay CSS appended later
  - Utilities apply: inspect an element with `gap-6`, `min-h-[500px]`, `grid` to confirm computed styles
  - Dashboard overlay opens and renders without collapsed panels; scroll areas work; no console Tailwind/CSS errors

2) Automated Tests (Playwright)
- Start server: `npm start`
- In another shell, run Playwright tests:
  - `npx playwright test tests/ops_dashboard_fixes.spec.js`
  - `npx playwright test tests/dashboard_grid_assignment.spec.js`
- Expected:
  - Grid container `#dashTaskList` has `display: grid` and correct columns after slider update
  - Bulk assignment bar toggles visibility based on selection
  - No failures related to missing layout classes

3) Regression Sweep
- Confirm unrelated UI areas (map, sidebars, weather overlay) function and style as before
- Resize viewport; check dashboard responsiveness; ensure no overflows or stacking regressions

## Risks and Mitigations
- Risk: Over-tight CSS selectors unintentionally override non-dashboard elements
  - Mitigation: Only use ID-scoped selectors under `#taskDashboard` and additive fallbacks gated by `.tw-missing`
- Risk: CSP blocks Tailwind CDN script
  - Mitigation: Runtime guard and fallbacks; document CSP requirement for `cdn.tailwindcss.com` script and inline style injection, or add nonce per policy

## Acceptance Criteria Mapping
- Fix broken dashboard layout without redesign
- Tailwind loads once, correct order; version pinned to 3.4.1
- Explicit layout contracts restored (no reliance on implicit parent context)
- Scoped overrides post-Tailwind; Preflight no longer breaks dashboard
- Defensive guards in place with visible warnings
- Playwright specs pass without layout-related failures
