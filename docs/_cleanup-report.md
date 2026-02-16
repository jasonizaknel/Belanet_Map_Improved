# Cleanup Report

This report enumerates files/folders that are likely redundant, obsolete, or generated, with justifications and safety notes.

## Candidates for Deletion (Now)
- Belanet_Map_Improved/* (images)
  - Why: Design/debug screenshots, not used at runtime
  - Safety: High; verify no references in external docs
- server_retry.log
  - Why: Transient log output
  - Safety: High; already covered by `.gitignore` patterns
- tests/tmp_debug.spec.js
  - Why: Temporary debug spec
  - Safety: High; ensure no CI relies on it
- Data/reports/*.json
  - Why: Generated simulation/usage reports
  - Safety: High; confirm not used in tests
- repo/belanet-map-improved.md
  - Why: Legacy overview, superseded by `/docs`
  - Safety: Medium; archive in PR description or Wiki if needed

## Candidates After Refactor / With Review
- test_tasks.js
  - Why: Hard-coded credentials; non-production utility
  - Safety: Replace with env-driven script or remove after migration. Remove credentials immediately.
- Visual Studio Projects.code-workspace
  - Why: Editor-specific convenience file
  - Safety: Developer preference; safe to remove if team does not use it

## Dependency Checks Before Deleting
- Full-text search for filenames across repo (including HTML/CSS/JS) to confirm zero inbound references
- Ensure Playwright tests do not reference deleted assets
- Confirm no automation or scripts archive these artifacts externally

## Additional Hygiene
- Extend `.gitignore` if needed to ensure generated artifacts (e.g., Data/reports/*.json) do not enter VCS
- Scrub any committed secrets (e.g., test_tasks.js) from history using appropriate tooling
