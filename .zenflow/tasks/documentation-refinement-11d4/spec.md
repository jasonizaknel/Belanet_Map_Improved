# Technical Specification — Documentation Refinement

## Overview
- **Goal**: Extend, normalize, and enrich existing documentation under `docs/` to enable confident large-scale refactors without source inspection.
- **Scope**: Documentation-only changes inside `docs/`. No source code modifications.
- **Difficulty**: Medium — broad, repository-wide edits with careful consistency and coverage checks, but low algorithmic complexity.

## Assumptions & Constraints
- **Assumptions**:
  - A `docs/` mirror with per-file and per-folder docs exists. If it is missing or incomplete, pause and request guidance before generating new file-level docs.
- **Hard constraints**:
  - Do not modify source code or delete files
  - Only add/modify documentation under `docs/`
  - Preserve existing content; append required sections; normalize consistently

## Technical Context
- Repository appears to be a JavaScript/Node-based web app with:
  - UI components: `User Interface/`
  - Marker/simulation: `Marker Scripts/Markers.js`, `Marker Scripts/Simulation.js`
  - Weather system: `src/weather/`, weather tests in `tests/`
  - Server/runtime: `server.js`, `map.html`, `state.js`
- Documentation format: Markdown (`.md`) with folder-level READMEs and file-level documents

## Deliverables by Phase

### Phase 1: Per-File Documentation Enhancements (Mandatory)
- For every existing file-level doc in `docs/`, append a final section exactly named:
  - `## Refactor Notes`
    - `- Candidates for extraction:`
    - `- Candidates for merge:`
    - `- Known inefficiencies:`
    - `- Rename or relocation suggestions:`
- Guidelines:
  - Keep existing content intact; add the section at the end
  - Provide specific, actionable bullets where possible; leave as empty bullets only when nothing applies

### Phase 2: Folder-Level Consistency & Structure Notes
- For every folder README under `docs/`, append a section named `## Naming & Structural Consistency` covering:
  - Naming conventions (camelCase, kebab-case, spaces)
  - Structure normalization suggestions
  - Import-path and organization concerns

### Phase 3: Global Architecture & Dependency Mapping
- Create `docs/_architecture.md` with:
  - Entry points (server, UI bootstrap, scripts)
  - Subsystems: UI layer, marker/simulation logic, weather system, state & data flow, utilities
  - ASCII dependency flow diagrams showing UI → services → data; weather overlay pipeline; marker generation/consumption
- Source-of-truth derived from existing docs; avoid reinventing design beyond available information

### Phase 4: Duplication & Overlap Analysis
- Extend `docs/_cleanup-report.md` with `## Suspected Duplication Clusters`:
  - List overlapping files, versioned/forked logic, and similar UI components/utilities
  - Observational only; no deletions or code changes

### Phase 5: Cleanup Severity Tagging
- Normalize cleanup/deletion recommendations with one severity tag per item:
  - `[SAFE-DELETE]`, `[REQUIRES-REFACTOR]`, `[SECURITY-RISK]`, `[ARCHIVAL]`
- Each item includes: tag, short justification, and whether safe now or post-refactor

### Phase 6: Technical Debt Index
- Create `docs/_technical-debt.md` with only links to existing file docs and a 1-line summary each
- Acts as a prioritized hit-list; no new analysis beyond what already exists

### Phase 7: Safety & Guardrail Notes
- For any docs under `.git`, `.zenflow`, or tooling/metadata folders, add top disclaimer:
  - `⚠ This folder is documented for audit and understanding only. Do not modify contents manually.`

### Phase 8: Index & Navigation Update
- Update `docs/_index.md` to link to:
  - `_architecture.md`
  - `_technical-debt.md`
  - updated `_cleanup-report.md`
- Ensure navigation remains coherent and consistent

## Implementation Approach
1. Preflight
   - Verify `docs/` presence. If missing or incomplete, pause and request direction before creating per-file docs. Creating new global docs in `docs/` (e.g., `_architecture.md`, `_technical-debt.md`) is permitted.
   - Back up or snapshot current `docs/` for safety (logical checkpoint; no file copies committed).
2. Inventory & Classification
   - Enumerate all `docs/` files and classify into file-level docs vs folder-level READMEs vs global docs.
3. Batch Edits — File-Level
   - Append the standardized `## Refactor Notes` section to every file-level doc.
   - Keep formatting exact and consistent; avoid redundant sections if already present.
4. Batch Edits — Folder-Level
   - Append `## Naming & Structural Consistency` to each folder README with concrete notes.
5. Global Docs Creation/Update
   - Write `docs/_architecture.md` with subsystem and flow diagrams informed by current docs.
   - Update `docs/_cleanup-report.md` with duplication clusters and severity tags.
   - Write `docs/_technical-debt.md` as a link-only index with 1-line summaries.
6. Safety & Guardrails
   - Prepend or add the disclaimer to docs covering `.git`, `.zenflow`, or tooling/metadata.
7. Navigation Update
   - Update `docs/_index.md` to include links to all new/updated global docs.
8. Verification & Normalization
   - Run consistency checks:
     - Coverage: every file-level doc has `## Refactor Notes`
     - Every folder README has `## Naming & Structural Consistency`
     - Global docs exist and `_index.md` links to them
     - All new sections use the exact titles and bullet labels

## Source Files Touched (Docs Only)
- Create/update inside `docs/` only:
  - `docs/_architecture.md` (new)
  - `docs/_technical-debt.md` (new)
  - `docs/_cleanup-report.md` (update)
  - `docs/_index.md` (update)
  - `docs/**/README.md` (append section)
  - `docs/**/*.md` file-level docs (append `## Refactor Notes`)
  - Docs for `.git`, `.zenflow`, tooling/metadata (prepend/append disclaimer)

## Data Model / API / Interface Changes
- None. Documentation-only updates.

## Verification Plan
- Static checks (manual or scripted during implementation):
  - Enumerate `docs/**/*.md` and assert:
    - If file-level doc → contains a single `## Refactor Notes` at end with 4 bullets
    - If folder README → contains `## Naming & Structural Consistency`
  - Assert presence of `docs/_architecture.md` and `docs/_technical-debt.md`
  - Confirm `_index.md` links to `_architecture.md`, `_technical-debt.md`, updated `_cleanup-report.md`
  - Spot-check 5–10 representative modules (UI, markers, weather, server) for correctness and clarity
- No build/test commands are required; this is a docs-only task

## Risks & Mitigations
- Risk: `docs/` mirror is missing or incomplete
  - Mitigation: Pause and request instructions before generating per-file docs; proceed only with allowed global docs
- Risk: Introducing duplicate sections or inconsistent titles
  - Mitigation: Grep-based verification and consistent edit patterns
- Risk: Over-speculation in refactor notes
  - Mitigation: Clearly mark speculative items and prefer references to existing behavior described in current docs

## Handoff Criteria
- All required sections added and normalized across `docs/`
- Global docs created and linked from `_index.md`
- `_cleanup-report.md` updated with duplication clusters and severity tags
- Technical debt index present and prioritized
- No source code changes committed
