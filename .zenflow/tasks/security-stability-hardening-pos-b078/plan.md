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
<!-- chat-id: 8fcb162c-6ca5-4b46-ae93-d7b618360ed3 -->

- Saved spec to `{@artifacts_path}/spec.md`
- Complexity: hard (multi-area hardening across server, UI, and integrations)

### [x] Step: R1 – Splynx Session Hardening
<!-- chat-id: 9f36773c-142b-4a8a-851e-62e83ab4fcdc -->
- Add circuit-breaker (failure counters, cooldown) to Playwright flows
- Enforce per-stage and total timeouts
- Structured logs around login/CSRF/comment; explicit error states
- Metrics: `integration_calls_total{service=splynx,...}`, `splynx_circuit_open`
- Verify with bad creds → circuit opens; restore → recovers

### [x] Step: R2 – Centralized TTL/LRU Caches
<!-- chat-id: 25c0a172-44bb-4bc8-a260-c762f62e45b4 -->
- Add `lib/cache.js` (TTL + max-size + in-flight de-dupe)
- Replace ad-hoc caches in `server.js` and `SplynxService`
- Metrics: `cache_hit|cache_miss|cache_eviction{cache}`
- Verify bounded memory and correct hit/miss behavior

### [x] Step: R3 – ENV Validation & Readiness
<!-- chat-id: e1111b28-0b16-4102-9767-152ba807705c -->
- Add `lib/config.js` and remove empty-string fallbacks
- Fail readiness when enabled features lack required env
- Update `.env.example` with explicit requirements
- Verify `/ready` returns 503/200 appropriately

### [x] Step: R4 – Weather Duplication Warnings (Interim)
<!-- chat-id: 036a0b8c-7cb8-4158-875b-c02b7e4f9f48 -->
- Add runtime warnings: client cache advisory; server authoritative
- Expose TTLs via logs/metrics; compare client vs server fetch rates
- Verify metrics and console warnings visible

### [x] Step: R5 – Async File I/O & Preload
<!-- chat-id: 4441e66b-877c-4be5-87ef-927352d36d2f -->
- Convert sync fs ops to async; add timings
- Preload or background parse spreadsheets; keep reload endpoint
- Verify latency improvements and timing metrics

### [x] Step: R6 – CDN Pinning + SRI
<!-- chat-id: 6323085e-4208-4dcd-b610-cbcef6f681f1 -->
- Pin Tailwind/Lucide/Animate.css versions in `map.html`
- Add SRI attributes; document fallback in `docs/map.html.md`
- Verify assets load with integrity and notes exist

### [ ] Step: R7 – Secrets Hygiene in Utilities/Tests
- Remove hardcoded secrets (e.g., `test_tasks.js`) → env-based or quarantine
- Update `.env.example`; document findings in cleanup report
- Verify no secrets remain via repo scan

### [ ] Step: R8 – Safer Name Matching
- Add normalization (case/whitespace/accents) utilities
- Detect ambiguities; surface warnings; avoid auto-assign on ties
- Verify with crafted ambiguous inputs

### [ ] Step: R9 – WebSocket Rate Limit/Backpressure
- Add per-topic batching/rate-limits; drop under high `bufferedAmount`
- Metrics: `ws_client_count`, `ws_broadcast_total`, `ws_dropped_total{reason}`
- Verify under load with multiple clients

### [ ] Step: R10 – Unified Retry/Timeouts
- Standardize all outbound HTTP on `fetchWithRetry`
- Remove ad-hoc retries; ensure global limits respected
- Verify timeouts/retries via simulated failures

### [ ] Step: R11 – LocalStorage Namespacing & Schema
- Namespace keys with version; add schema checks and graceful reset
- Verify corrupted state resets and valid state persists

### [ ] Step: R12 – Test Stability Aids
- Document test prerequisites and startup waits
- Configurable ports and network dependency flags
- Verify fewer false negatives running e2e flows

### [ ] Step: Update docs

Update all the relevant docs/ files to include the changes made during this task.
