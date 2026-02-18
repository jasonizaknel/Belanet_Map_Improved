# Cleanup Report

This report enumerates files/folders that are likely redundant, obsolete, or generated, with justifications and safety notes.

## Candidates for Deletion (Now)
- [ARCHIVAL] Belanet_Map_Improved/* (images)
  - Why: Design/debug screenshots, not used at runtime
  - Safety: Safe now; verify no references in external docs
- [SAFE-DELETE] server_retry.log
  - Why: Transient log output
  - Safety: Safe now; already covered by `.gitignore` patterns
- [SAFE-DELETE] tests/tmp_debug.spec.js
  - Why: Temporary debug spec
  - Safety: Safe now; ensure no CI relies on it
- [SAFE-DELETE] Data/reports/*.json
  - Why: Generated simulation/usage reports
  - Safety: Safe now; confirm not used in tests
- [ARCHIVAL] repo/belanet-map-improved.md
  - Why: Legacy overview, superseded by `/docs`
  - Safety: Post-refactor archival optional; ensure coverage in docs/Wiki

## Candidates After Refactor / With Review
- [SECURITY-RISK] test_tasks.js
  - Why: Hard-coded credentials; non-production utility
  - Safety: Remove credentials immediately; delete post-refactor once replaced with env-driven or admin tool
- [ARCHIVAL] Visual Studio Projects.code-workspace
  - Why: Editor-specific convenience file
  - Safety: Safe now if team standardizes on workspace config elsewhere

## Suspected Duplication Clusters
- Weather fetching and caching logic
  - Centralized: `services/WeatherBackend.js` owns caching, TTLs, and quota enforcement
  - Clients: `src/weather/WeatherService.js` maintains an advisory cache and surfaces server `_meta`
  - Status: [RESOLVED] duplication eliminated; server is the source of truth
- Host listing utilities
  - `list_hosts.js` vs `list_hosts_v2.js` targeting similar outputs [REQUIRES-REFACTOR]
- Marker verification utilities
  - `verify_markers.js` vs `check_markers.js` overlapping validation [REQUIRES-REFACTOR]
- Nagios datasets
  - `nagios_hosts.txt` vs `nagios_hosts_new.txt` versioned snapshots [ARCHIVAL]
- Dashboard features and tests
  - Multiple dashboard e2e specs cover overlapping flows; consider shared fixtures/utilities [REQUIRES-REFACTOR]
- Simulation vs live tracker handling
  - `Marker Scripts/Simulation.js` and tracker handling in `Markers.js` both manage polylines/state [REQUIRES-REFACTOR]

## Dependency Checks Before Deleting
- Full-text search for filenames across repo (including HTML/CSS/JS) to confirm zero inbound references
- Ensure Playwright tests do not reference deleted assets
- Confirm no automation or scripts archive these artifacts externally

## Additional Hygiene
- Extend `.gitignore` if needed to ensure generated artifacts (e.g., Data/reports/*.json) do not enter VCS
- Scrub any committed secrets (e.g., test_tasks.js) from history using appropriate tooling
