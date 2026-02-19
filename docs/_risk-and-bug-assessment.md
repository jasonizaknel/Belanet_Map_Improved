# Risk and Bug Assessment

Each item is inferred strictly from the documentation.

## 1) Splynx Session via Playwright Is Brittle
- **Severity**: High
- **Confidence**: Likely
- **Impact**: Admin comment/task flows break when UI/CSRF patterns change; sustained outage for assignments/updates.
- **Why in Docs**: [./server.js.md](./server.js.md) uses headless Playwright to scrape sessions and post CSRF-protected forms; noted as brittle.

## 2) Global In-Memory Caches with Concurrency Risks
- **Severity**: High
- **Confidence**: Possible
- **Impact**: Stale data served, race conditions under concurrent requests, memory growth without bounds.
- **Why in Docs**: Multiple caches in [./server.js.md](./server.js.md); varied error handling and broadcast timers. Partially mitigated by Phase 3 (API Broker & Deduplication).

## 3) ENV Defaults to Empty Strings
- **Severity**: Medium
- **Confidence**: Likely
- **Impact**: Auth loops, unexpected 401s, hidden misconfiguration.
- **Why in Docs**: Called out in Bug & Risk Notes of [./server.js.md](./server.js.md).

## 4) Client/Server Weather Cache Duplication (RESOLVED)
- **Severity**: Medium
- **Confidence**: Certain
- **Impact**: Inconsistent TTLs/quotas, double counting, debugging overhead.
- **Why in Docs**: Duplication cluster in [./_cleanup-report.md](./_cleanup-report.md). Resolved in Phase 2 roadmap.

## 5) Blocking File I/O on Request Path
- **Severity**: Medium
- **Confidence**: Possible
- **Impact**: Event loop stalls on large Excel/JSON files; timeouts for clients.
- **Why in Docs**: File I/O mentioned in request lifecycle in [./server.js.md](./server.js.md).

## 6) External CDN Dependency for UI
- **Severity**: Medium
- **Confidence**: Certain
- **Impact**: Visual regressions or downtime if CDNs unavailable; CSP concerns.
- **Why in Docs**: [./map.html.md](./map.html.md) lists Tailwind/Lucide/Animate.css via CDNs; risk noted.

## 7) Secrets Handling in Utilities and Tests (RESOLVED)
- **Severity**: High
- **Confidence**: Likely
- **Impact**: Credential leakage; compromised access to third-party systems.
- **Why in Docs**: [./_cleanup-report.md](./_cleanup-report.md) flags `test_tasks.js` and debug scripts. Resolved in Phase 0 roadmap.

## 8) Tracker/Admin Name Matching by Heuristics
- **Severity**: Medium
- **Confidence**: Likely
- **Impact**: Mis-assignment of tasks; incorrect workload metrics.
- **Why in Docs**: [./User%20Interface/TeamSidebar.js.md](./User%20Interface/TeamSidebar.js.md) notes brittle string comparisons.

## 9) WebSocket Broadcast Flooding & Missing Backpressure
- **Severity**: Medium
- **Confidence**: Possible
- **Impact**: Server CPU spikes and client freezes during bursts; cascading failures on reconnect storms.
- **Why in Docs**: Broadcast loops across multiple domains in [./server.js.md](./server.js.md); no rate/backpressure policy documented.

## 10) Inconsistent Retry/Timeout Policies Across Integrations
- **Severity**: Low
- **Confidence**: Likely
- **Impact**: Uneven recovery; latent failures in scraping and polling.
- **Why in Docs**: Weather client standardizes retries, but server paths vary. See [./src/weather/WeatherService.js.md](./src/weather/WeatherService.js.md) vs [./server.js.md](./server.js.md).

## 11) LocalStorage State Corruption & Key Collisions
- **Severity**: Low
- **Confidence**: Possible
- **Impact**: UI anomalies and lost preferences; overlay geometry conflicts when `id` reused.
- **Why in Docs**: Risks listed in [./state.js.md](./state.js.md) and [./src/weather/WeatherOverlay.js.md](./src/weather/WeatherOverlay.js.md).

## 12) Test Environment Flakiness
- **Severity**: Medium
- **Confidence**: Likely
- **Impact**: Red/yellow CI runs; hard-to-reproduce local failures.
- **Why in Docs**: Tests assume running server, ports, and external network. See [./tests/README.md](./tests/README.md), [./package.json.md](./package.json.md).

## 13) Workspace Isolation Leakage (NEW)
- **Severity**: Medium
- **Confidence**: Possible
- **Impact**: One user's state (toggles, simulations) affecting another; security risk if workspace IDs are predictable.
- **Why in Docs**: New architecture proposed in Phase 3 of [./docs/_phased-roadmap.md](./docs/_phased-roadmap.md). Requires robust validation and UUID-based identification.
