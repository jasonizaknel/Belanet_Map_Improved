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
<!-- chat-id: f27e4ae7-20f1-4049-a67c-ea38b9cf8e34 -->

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

### [x] Step: Unify Weather Toggle (Single Source of Truth)
<!-- chat-id: 75d973cf-175c-4a54-b88f-5750b820d3cf -->
- Remove extra `#toggleWeatherBtn` handler in [./map.html](./map.html)
- Extend `toggleWeather()` in [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js) to mount/show and hide/destroy `WeatherOverlay`
- On load, normalize from `AppState.visibility.weather` and reflect button state
- Verification: Button class syncs with overlay visibility; no inverted behavior

### [ ] Step: Remove Overlay Close Paths & Move Clock
- In [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js): remove close button and `Escape` hide logic
- Remove clock UI from overlay; add fixed bottom-right clock in [./map.html](./map.html) with minimal CSS
- Verification: Overlay can only be closed via Weather button; clock visible bottom-right

### [ ] Step: Stabilize Overlay Resize & Layout
- In [./src/weather/weather-overlay.css](./src/weather/weather-overlay.css): add `box-sizing: border-box`, `min-width: 0; min-height: 0` on grid children
- In [./src/weather/WeatherOverlay.js](./src/weather/WeatherOverlay.js): remove width/height `-2px` restores; ensure DPR-safe canvas sizing; throttle resize updates if needed
- Verification: Smooth resize, no jitter/overflow; position persists across reload

### [ ] Step: Migrate Server to One Call API 3.0
- Update [./server.js](./server.js) `/api/weather` to use `https://api.openweathermap.org/data/3.0/onecall` with `exclude=minutely,alerts&units=metric`
- Keep 10–15m cache TTL; remove 2.5 fallback
- Verification: Endpoint returns One Call 3.0 shape; logs show cache hits; tests green

### [ ] Step: Enable All Weather Tile Layers
- In [./Marker Scripts/Markers.js](./Marker%20Scripts/Markers.js): update `updateWeatherLayers()` to support `clouds_new`, `precipitation_new`, `rain_new`, `snow_new`, `temp_new`, `wind_new`, `pressure_new`
- Default selection to `clouds_new`, `precipitation_new`, `temp_new`; ensure safe removal from `overlayMapTypes`
- Verification: Tiles render and animate as available; no silent failures

### [ ] Step: API Call Optimization
- Ensure `toggleWeather()` never triggers One Call fetch directly; rely on `WeatherService` caching and server cache
- Confirm no duplicate calls on toggles; share location/time windows where applicable
- Verification: Request counts remain low during normal use; spot-check via logs

### [ ] Step: E2E Tests & Screenshots
- Request ENV vars before running: `OPENWEATHER_API_KEY`, `GOOGLE_MAPS_KEY`
- Add Playwright flows to toggle overlay, test resize stability, and confirm tiles (Temperature, Precipitation, Rain, Snow)
- Capture screenshots of overlay and tile layers; store under `tests/test-results/`
- Verification: All assertions pass; screenshots generated
