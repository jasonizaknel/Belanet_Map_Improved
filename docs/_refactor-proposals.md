# Refactor & Architecture Proposals

Conceptual proposals only; no code changes.

## A) Extract Integration Services from server.js
- **Current Documented Structure**: A monolithic [./server.js.md](./server.js.md) implements Splynx, Traccar, Nagios, Weather integrations, caching, retries, and broadcasting.
- **Proposed Change**: Extract `SplynxService`, `NagiosService`, `TrackerService`, and `WeatherBackend` modules with explicit contracts (fetch, normalize, cache, metrics). Central app composes services and HTTP/WS handlers.
- **Benefits**: Testability, clearer ownership of caches/TTLs, independent retries, easier failure isolation.
- **Risks**: Short-term complexity; potential regressions from changed initialization order and shared state.
- **Prerequisites**: Define common fetch/retry/timeouts; choose a metrics/logging interface.

## B) Weather Cache Ownership & Client Slimming
- **Current Documented Structure**: Client [./src/weather/WeatherService.js.md](./src/weather/WeatherService.js.md) and server [./server.js.md](./server.js.md) both manage caches/quotas.
- **Proposed Change**: Server becomes the single cache/limit authority; client delegates counters and respects server TTLs via headers or a stats endpoint.
- **Benefits**: Eliminates drift/double counting; simplifies client code; centralized quota control.
- **Risks**: Requires careful migration to avoid user-visible quota regressions.
- **Prerequisites**: Define server stats schema and TTL headers; deprecate client counters in stages.

## C) Replace window.AppState with a Small Store
- **Current Documented Structure**: [./state.js.md](./state.js.md) defines a large global object with ad-hoc events and widespread mutation.
- **Proposed Change**: Introduce a minimal evented store (pub/sub) or ES-module singleton with explicit update actions. Preserve `stateChanged` compatibility during transition.
- **Benefits**: Reduced coupling, safer updates, clearer contracts for UI modules.
- **Risks**: Touches many call sites; requires staged rollout.
- **Prerequisites**: Inventory state consumers, define action vocabulary, add migration shims.

## D) Split Markers.js by Responsibility
- **Current Documented Structure**: [./Marker%20Scripts/Markers.js.md](./Marker%20Scripts/Markers.js.md) handles data loading, mapping, rendering, and WebSocket maintenance.
- **Proposed Change**: Separate into `data-loader`, `renderer`, and `ws-transport` modules linked through explicit interfaces.
- **Benefits**: Isolated failures, targeted testing, lower cognitive load.
- **Risks**: Temporary duplication during migration.
- **Prerequisites**: Define marker DTOs and rendering contracts.

## E) Simulation Engine vs UI
- **Current Documented Structure**: [./Marker%20Scripts/Simulation.js.md](./Marker%20Scripts/Simulation.js.md) blends core logic with UI.
- **Proposed Change**: Extract a deterministic engine (pure/time-controlled) from UI layer. Seeded RNG for reproducibility.
- **Benefits**: Stable tests, reusable engine, clearer performance profiling.
- **Risks**: Requires re-binding UI controls; initial refactor cost.
- **Prerequisites**: Identify engine inputs/outputs; define tick contract with [./src/weather/ClockManager.js.md](./src/weather/ClockManager.js.md).

## F) Normalize UI Module Imports and DOM Contracts
- **Current Documented Structure**: UI modules assume specific IDs/classes and global functions. See [./User%20Interface/OperationalDashboard.js.md](./User%20Interface/OperationalDashboard.js.md), [./User%20Interface/Sidebar.js.md](./User%20Interface/Sidebar.js.md).
- **Proposed Change**: Migrate to ES modules incrementally; centralize DOM selectors; add lightweight adapter layer for globals.
- **Benefits**: Fewer regressions on HTML changes; easier code splitting/testing.
- **Risks**: Loader/config changes; bundle strategy decisions.
- **Prerequisites**: Decide on build tooling (or keep native modules), define adapter shape.

## G) Observability: Metrics + Structured Logging
- **Current Documented Structure**: Ad-hoc console logging, partial stats persistence.
- **Proposed Change**: Add JSON logs with correlation IDs and a metrics collector interface; expose `/metrics.json`.
- **Benefits**: Faster triage; capacity planning; SLO tracking.
- **Risks**: Log volume and PI data handling; need redaction rules.
- **Prerequisites**: Define log schema, retention policy, and redactions.

## H) Config Consolidation
- **Current Documented Structure**: Scattered constants and localStorage flags.
- **Proposed Change**: Single config module on the server and a mirrored client-readable config endpoint; central UI pane for toggles.
- **Benefits**: Lower drift; clearer change control.
- **Risks**: Migration churn; potential mismatch during rollout.
- **Prerequisites**: Config schema, `.env.example`, and defaults strategy.
