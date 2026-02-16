# Phased Roadmap

References items from analysis, features, risks, and refactor proposals. Phases are ordered to minimize risk and maximize feedback.

## Phase 0: Safety & Visibility
- **Included Items**:
  - Metrics/logging endpoints (Feature 2, Refactor G)
  - CDN pinning and local fallbacks (Feature 9)
  - Secrets audit and removal of risky utilities or credentials (Risk 7, [./_cleanup-report.md](./_cleanup-report.md))
  - Health/readiness checks (Feature 2)
- **Goals**: Improve operability and reduce unknowns without changing behavior.
- **Dependencies**: None.
- **Risk Level**: Low

## Phase 1: Structural Refactor
- **Included Items**:
  - Extract integration services (Refactor A)
  - Normalize retry/timeout policies (Feature 12)
  - Structured logging baseline (Refactor G)
- **Goals**: Reduce coupling in [./server.js.md](./server.js.md); isolate failure domains; standardize networking behavior.
- **Dependencies**: Phase 0 metrics to observe effects.
- **Risk Level**: Medium

## Phase 2: Weather Ownership & Client Slimming
- **Included Items**:
  - Server-owned weather cache and stats (Feature 1, Refactor B)
  - Client adjustments to delegate quotas and TTLs (Refactor B)
- **Goals**: Eliminate duplication and drift; centralize quotas.
- **Dependencies**: Phase 1 service extraction to house WeatherBackend.
- **Risk Level**: Medium

## Phase 3: Auth Hardening & Assignment Improvements
- **Included Items**:
  - Admin token rotation and scoped RBAC (Feature 4)
  - Task auto-assignment v2 scoring and explainability (Feature 5)
- **Goals**: Strengthen security posture; improve operational efficiency and transparency.
- **Dependencies**: Phase 1 logging for audit trails; Phase 2 for stable telemetry.
- **Risk Level**: Medium–High

## Phase 4: UI/UX & Module Boundaries
- **Included Items**:
  - Split Markers.js (Refactor D)
  - Simulation engine/UI separation with deterministic seeds (Feature 11, Refactor E)
  - ES module migration path, DOM adapter, and config pane (Refactor F, Feature 8)
  - Diagnostics panel for markers/data (Feature 10)
- **Goals**: Increase maintainability and testability; improve UX without altering core behaviors.
- **Dependencies**: Earlier phases for telemetry and service contracts.
- **Risk Level**: Medium

## Phase 5: Testing & Tooling Maturity
- **Included Items**:
  - Test runner and env bootstrap scripts (Feature 7)
  - Stabilize Playwright E2E flows with deterministic fixtures and seeds
- **Goals**: Lower onboarding friction; reduce CI flakes.
- **Dependencies**: Prior structural changes settled.
- **Risk Level**: Low
