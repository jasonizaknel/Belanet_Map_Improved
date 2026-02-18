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
<!-- chat-id: 88b222bf-32e0-4b9d-b1b5-285023a7594c -->

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

### [x] Step: Server Weather Cache Implementation
<!-- chat-id: 8410cda1-b957-4af1-a538-65a2674bccb8 -->
- [x] Centralize server cache in `services/WeatherBackend.js` using `LruTtlCache`
- [x] Implement TTL enforcement (global and per-coordinate)
- [x] Implement quota accounting and persistence
- [x] Collect stats: requests, cache hits/misses, failures; expose `_meta`

### [x] Step: Server Routes & Cleanup
<!-- chat-id: f9ae90c0-33d5-4c5c-987a-b0c4787cda65 -->
- [x] Remove duplicate caches from `server.js` and delegate to `WeatherBackend`
- [x] Ensure `/api/weather`, `/api/onecall`, and `/api/weather/stats*` return `_meta` and proper headers
- [x] Confirm logging and telemetry reflect cache behavior and quota enforcement

### [x] Step: Client Refactor
<!-- chat-id: 823df323-389b-46b7-9379-44d70221181b -->
- [x] Default `WeatherService` to use server base `/api/onecall`
- [x] Delegate quota and TTL validation to server; keep client cache advisory-only
- [x] Maintain backward-compatible API; surface server stats where applicable

### [ ] Step: Module Update & Integration
- [ ] Update `src/weather/WeatherOverlay.js` to rely on server-provided stats and cache ownership
- [ ] Update any dependent modules to reference centralized server cache
- [ ] Verify API signatures remain backward-compatible

### [ ] Step: Validation & Testing
- [ ] Unit tests for `WeatherBackend` (hits/misses, TTL expiration, stale return, quota 429)
- [ ] E2E test for multiple clients reading server cache
- [ ] Update client tests to focus on normalization and server metadata handling
- [ ] Confirm telemetry/logging metrics increment as expected

### [ ] Step: Documentation & Notes
- [ ] Update per-file docs for `WeatherService.js`, `WeatherOverlay.js`, and affected modules
- [ ] Add notes on quota centralization, server ownership, and removed client responsibilities
