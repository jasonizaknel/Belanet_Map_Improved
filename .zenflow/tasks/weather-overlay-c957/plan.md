# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: 3c516762-afb5-42eb-abd1-d27bdecaf39d -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Important: unit tests must be part of each implementation task, not separate tasks. Each task should implement the code and its tests together, if relevant.

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

---

### [x] Step: Implement WeatherService
<!-- chat-id: c6d4741d-ff91-4347-be70-852d4917f574 -->
- Create `src/weather/WeatherService.js` with constructor options `{ apiKey, baseUrl, ttl, storage }`
- Implement `fetchOneCall`, `getCurrent`, `getHourly`, `getDaily`, and `getHourly3h` with normalization
- Add caching with TTL and SWR policy; localStorage persistence when available
- Implement categorized error handling (network, 401, 429, 5xx) with retry/backoff
- Unit tests: normalization, 3‑hour resampling, caching freshness, and retry behavior with mocked fetch
- Verification: manual fetch for sample coords, confirm structure and units

### [ ] Step: Implement ClockManager
- Create `src/weather/ClockManager.js` with modes `realtime|simulation`, adjustable rate 0.5×–10×
- RAF-driven tick loop; events: `tick`, `mode`, `rate`, `timeSet`; Page Visibility backpressure
- Unit tests: rate math, mode switching, simulation anchoring, tick cadence under visibility changes

### [ ] Step: Implement WeatherOverlay UI and CSS
- Create `src/weather/WeatherOverlay.js` and `src/weather/weather-overlay.css`
- Build overlay DOM (header/body/footer) with drag, resize, pin/unpin, and per-layer toggles
- Implement canvas renderer for layers: temperature gradient, precipitation sprites, wind particles, humidity fog, cloud noise
- Drive animations from `ClockManager`; interpolate between hourly points; apply predictive easing
- Persist position/size/layers/mode/rate in localStorage; responsive scaling with devicePixelRatio
- Unit tests: mount/unmount smoke, event wiring, state persistence; minimal render assertions
- Manual verification: interactions, layer toggles, animation responsiveness

### [ ] Step: Integration and Demo Harness
- Integrate into existing page (e.g., `map.html`) if present; otherwise add `public/weather-demo.html` to mount and exercise overlay
- Wire environment API key detection and pass to `WeatherService`; expose controls for lat/lon
- Manual verification checklist across screen sizes and browsers

### [ ] Step: Performance and Polish
- Optimize draw loop; reduce effect density on low FPS or when tab hidden; offscreen canvas composition
- Validate responsiveness and crisp rendering at various DPR values
- Add keyboard shortcuts (Esc, p, m, [, ]) and ensure non-interference with host app

### [ ] Step: Error Handling UX and Telemetry
- Surface categorized errors with actionable hints; fallback to cached data when available
- Emit overlay/service events for host logging/analytics if present

### [ ] Step: Final Report
- Write `{@artifacts_path}/report.md` detailing implementation, tests, and notable issues
