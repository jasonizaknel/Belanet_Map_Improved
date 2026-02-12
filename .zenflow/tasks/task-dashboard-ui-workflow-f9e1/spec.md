# Technical Specification — Task Dashboard UI & Workflow

## Technical Context
- Runtime: Node.js + Express backend (`server.js`) serving static assets and JSON APIs
- Frontend: Vanilla JS + DOM, Tailwind via CDN, Lucide icons, Animate.css
- State: Global `window.AppState` (see `state.js`), event-driven updates via `stateChanged`
- Key UI/Logic files:
  - Dashboard logic: [./User Interface/OperationalDashboard.js](./User%20Interface/OperationalDashboard.js)
  - Sidebar/tabs: [./User Interface/Sidebar.js](./User%20Interface/Sidebar.js)
  - Team sidebar: [./User Interface/TeamSidebar.js](./User%20Interface/TeamSidebar.js)
  - Global page/markup: [./map.html](./map.html)
  - Styles: [./stylesheet.css](./stylesheet.css)
  - Data aggregation: [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js)
- Constraints: No backend changes; operate only in frontend/state/UI

## Implementation Approach

The implementation focuses on enhancing existing dashboard components in `OperationalDashboard.js` and markup in `map.html`, with minimal new helpers and styles.

### Subtask 1: Task Card Information Hierarchy
- Update `updatePriorityTaskQueue()` to:
  - Promote priority to the most dominant element: larger, left-aligned colored badge
  - Add task age text: "Opened Xh ago" (computed from `createdAt`)
  - De-emphasize secondary labels (category, sim/biz flags) using subdued color/weight
- Styles: add utility classes for visual hierarchy in `stylesheet.css` if needed

### Subtask 2: Task Age & SLA Risk Indicators
- Add `AppState.slaConfig` defaults and localStorage persistence
  - Example: `{ greenMins: 120, amberMins: 480 }` (red is > amber)
- Add SLA settings UI in Task Dashboard Strategy panel (config area) with 2 numeric inputs/sliders
  - Live-preview updates; persist to `localStorage('belanet_sla_config')`
- In `updatePriorityTaskQueue()` compute age → risk level; render a subtle indicator on card
  - Visuals: small top-right dot or left border overlay
  - Colors: green/amber/red reserved for SLA only

### Subtask 3: Expandable Task Cards
- Maintain inline layout; on click/hover expand card to reveal details
- Track expanded IDs in `AppState.dashboard.expanded` (Set-like via object or array)
- Expanded content includes:
  - Full title/description (from task fields), last updated (fallback to `createdAt`), assigned technician
  - Keep within card, no modal; use CSS transition for height

### Subtask 4: Filtering & Sorting Controls
- Add new controls to Priority Queue header (in `map.html`):
  - Filters: multi-select Priority, Status (via `getTaskStatusLabel`), Customer, Task Age (Today/24h/48h+), Unassigned-only
  - Sorting presets: Urgent First (default), Oldest First, Unassigned
- Persist current filters/sort in `AppState.dashboard.filters` and `localStorage('belanet_dashboard_filters')`
- Extend `updatePriorityTaskQueue()` to combine filters deterministically and apply selected sort

### Subtask 5: Density Toggle
- Add Compact/Comfortable toggle in Priority Queue header
- Persist selection in `localStorage('belanet_density')`; mirror to `AppState.dashboard.density`
- Apply via class switch on cards to reduce padding, font-size, and gaps in compact mode

### Subtask 6: Team Panel Actionable
- Drag-and-drop assignment already implemented between task cards and technician tiles
- Enhance workload semantics in `updateTechnicianGrid()`:
  - Visual labels: Available (<50%), Busy (50–80%), Overloaded (>80%)
  - Update immediately after assignment via existing state refresh

### Subtask 7: Technician Skills & Area Tags
- Render compact skill and region tags on technician tiles
- Data sources: `agent.skills` (array of strings) and `agent.region`/`area` if present; otherwise omit
- Include tags without changing backend; allow for simulated agents to include sample tags

### Subtask 8: Summary Metrics Interactive
- Make heartbeat metrics clickable (`hbOpenTickets`, `hbCriticalTasks`, `hbActiveTechs`)
- Clicking sets `AppState.metricFilter` and updates the Priority Queue accordingly
- Indicate active metric filter with visual state (accent ring/badge) and show a small "Clear" action near header

### Subtask 9: Metric Trend Indicators
- Maintain a short history buffer in `AppState.metricsHistory`
- Compute deltas for Open Tickets and Critical Priority; render up/down caret with small delta text
- Keep visuals subtle and non-distracting

### Subtask 10: Refine Visual Language & Color Usage
- Reserve saturated colors for Critical priority and SLA risk only
- Standardize icons on cards and tiles (Lucide set) and add `title` tooltips for ambiguous icons
- Adjust neutral backgrounds/borders for calmer appearance across lists

### Subtask 11: Empty & Error States
- In `updatePriorityTaskQueue()` and `updateTechnicianGrid()`:
  - Distinguish "No tasks loaded yet" (data null) vs. "No tasks match filters" (data present, empty after filters)
  - Add a Reset Filters button when filters cause emptiness
  - Provide brief guidance text for invalid/missing data

## Source Code Changes

- [./User Interface/OperationalDashboard.js](./User%20Interface/OperationalDashboard.js)
  - Compute `taskAge`, `slaRiskLevel`
  - Add/extend filter model and sorting presets
  - Implement expandable cards and density class switch
  - Add metric click handlers and trend calculations
  - Render technician load labels and skills/area tags
- [./map.html](./map.html)
  - Add SLA settings controls to the Strategy panel
  - Add new filter controls (status, customer, task age, unassigned) and sorting select
  - Add density toggle UI
  - Add minimal markup for trend badges next to metrics
- [./state.js](./state.js)
  - Extend with `dashboard: { density, filters, expanded }`
  - Add `slaConfig` defaults and `metricsHistory`
- [./stylesheet.css](./stylesheet.css)
  - Add SLA indicator dot/ring classes and density-compact adjustments
  - Minor neutralization of non-critical colors; ensure consistent icon styles
- [./User Interface/TeamSidebar.js](./User%20Interface/TeamSidebar.js) (optional)
  - If desired, mirror skills/area tags in member list/details

## Data Model / API / Interface Changes
- No backend API changes
- Frontend state additions:
  - `AppState.slaConfig = { greenMins: number, amberMins: number }`
  - `AppState.dashboard = { density: 'compact'|'comfortable', filters: {...}, expanded: Set<string> }`
  - `AppState.metricFilter = { type: 'open'|'critical'|'activeTechs'|null }`
  - `AppState.metricsHistory = { openTickets: number[], critical: number[] }`
- LocalStorage keys: `belanet_sla_config`, `belanet_dashboard_filters`, `belanet_density`

## Verification Approach

- Manual UI verification (served via `npm start`):
  - Priority dominance: visually scan cards; priority should be most prominent
  - Task age: each card shows "Opened X ago"
  - SLA risk: adjust thresholds in Strategy panel and confirm card indicators update after refresh/live reload
  - Expandable cards: click a card to expand; confirm description/last-updated/assignee are visible; layout remains grid-aligned
  - Filters: combine Priority+Status+Customer+Age+Unassigned; confirm list narrows correctly; Reset Filters restores
  - Sorting: switch presets; confirm stable/orderly reordering
  - Density: toggle compact/comfortable; state persists after reload
  - Drag & drop: drop task onto technician; workload/assignment reflect immediately
  - Skills/area tags: visible on technician tiles when data present
  - Metrics: click Open Tickets or Critical; task list filters accordingly; active state visible; Clear works
  - Trends: small up/down indicator next to metrics; direction reflects change since last refresh
  - Empty/error: remove all filters vs. apply restrictive filters; messages differ appropriately

- Code quality
  - Follow existing style and Tailwind classes already used across UI
  - Keep logic isolated to `OperationalDashboard.js` helpers and state additions

- Regression considerations
  - Ensure existing search/priority filter continue to function
  - Ensure simulation mode styling (Sim badge) and Live/Sim assignment continue unaffected
