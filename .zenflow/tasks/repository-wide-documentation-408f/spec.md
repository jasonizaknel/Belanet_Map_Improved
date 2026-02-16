# Repository-Wide Documentation — Technical Specification

## Technical Context
- **Primary Languages**: JavaScript (Node.js server + browser-side scripts), HTML, CSS
- **Package Manager**: npm (`package.json`, `package-lock.json`)
- **Key Dependencies**:
  - **Runtime**: `express`, `ws`, `dotenv`
  - **Data/Parsing**: `axios`, `cheerio`, `xlsx`
  - **Testing**: `@playwright/test`, `playwright`
- **Project Layout (observed)**:
  - Root: `server.js`, `map.html`, `stylesheet.css`, multiple utility scripts (`*.js`), data files (`nagios_*.txt/json`)
  - `src/weather`: overlay feature modules (`WeatherOverlay.js`, `WeatherService.js`, `ClockManager.js`, `weather-overlay.css`)
  - `User Interface`: UI modules (e.g., `OperationalDashboard.js`, `Sidebar.js`)
  - `Marker Scripts`: data/marker-related logic (`Markers.js`, `Simulation.js`)
  - `Data`: assets (`Icons/`) and reports (`reports/*.json`)
  - `tests`: Playwright-style `*.spec.js` end-to-end/integration tests
  - `Belanet_Map_Improved`: screenshots/images
  - `repo`: legacy note (`belanet-map-improved.md`) — to be made obsolete by the new docs
- **Module Style**: Primarily CommonJS/UMD (no `type: module`), compatible with Babel AST parsing
- **Ignored Paths** (from `.gitignore`): `node_modules/`, `.env`, `dist/`, `build/`, `.cache/`, `*.log`, `test-results/`, `playwright-report/`, `coverage/`, and some `Data/*`

## Goals
- Generate comprehensive, human-readable Markdown for every file and folder
- Mirror repository structure under a new `/docs` hierarchy
- Include dependency mapping, internal structure, and approximate line references
- Produce a global cleanup report highlighting deletion candidates with justification
- Do not change, delete, or refactor code — analysis and documentation only

## Output Structure
- **Root**: `docs/`
  - Mirrors the entire repository tree (excluding ignored/generated paths)
  - For each file `X.ext`: `docs/<path>/X.ext.md`
  - For each folder `dir/`: `docs/<path>/dir/README.md`
  - Index files:
    - `docs/_index.md` — global entry with repository map
    - `docs/_cleanup-report.md` — deletion/cleanup recommendations
    - `docs/_coverage.json` — machine-readable coverage summary (source count vs. docs count)

## Markdown Template (Files)
Each file doc will include:
1. **Identification**
   - Name, relative path, file type/language
2. **Purpose & Responsibility**
   - What it exists to do and why
3. **Internal Structure**
   - Key functions/classes/exports
   - High-level flow and critical variables
   - Approximate line anchors for each item
4. **Dependency Mapping**
   - Outbound: imports/require, HTML/CSS link/script references
   - Inbound: reverse-dependency listing (who uses this)
   - External services/APIs touched
5. **Bug & Risk Notes** (observational)
   - Potential bugs, duplication, tight coupling, fragility
6. **Deletion & Cleanup Suggestions (if any)**
   - Candidate status, justification, and dependency checks

## Markdown Template (Folders)
1. **Identification**
   - Folder name and relative path
2. **Purpose & Responsibility**
   - Cohesive domain/feature responsibilities
3. **Contents Overview**
   - Key subfolders/files with one-line summaries
4. **Dependency Graph**
   - Notable internal/external coupling
5. **Risk & Cleanup**
   - Deprecated/legacy areas, dead or large assets, screenshots, reports

## Implementation Approach

### 1) Repository Traversal and Classification
- Walk the repository recursively, respecting `.gitignore` patterns
- Classify files by extension and role:
  - **Code**: `.js`, `.mjs`, `.cjs`
  - **Markup/Styles**: `.html`, `.css`
  - **Tests**: `tests/**/*.spec.js`
  - **Data/Assets**: `.json`, `.txt`, images (`.png`, `.jpg`, `.jpeg`), Excel (`.xlsx`)
  - **Configs**: `package.json`, `.gitignore`, workspace files
- Exclude known generated outputs per `.gitignore`

### 2) Static Analysis — JavaScript
- Parse JavaScript with `@babel/parser` (sourceType: `unambiguous` + plugins as needed)
- Extract:
  - Exported and top-level functions/classes
  - Named constants and configuration objects
  - Approx. line spans from AST node `loc` fields
  - `require`/`import` dependencies; dynamic requires flagged as heuristic-only
- Identify UMD/CommonJS wrappers and surface the inner API

### 3) Static Analysis — HTML/CSS
- **HTML**: Use `cheerio` to map `<script>` and `<link>` dependencies, root elements, and data-attributes used by scripts
- **CSS**: List selectors, CSS variables, and file references (e.g., background images)

### 4) Reverse Dependency Mapping
- Build a global index of references:
  - For JS: where each module is imported/required
  - For HTML/CSS: scripts/styles included by which pages and components
  - For assets: grep-style references across code and styles; unreferenced items flagged

### 5) Approximate Line References
- Use AST node `loc.start.line` for functions/classes/consts
- For non-AST content (HTML, CSS, data), use regex/heuristics to estimate key anchors

### 6) Cleanup Detection Heuristics
- **Deletion candidates**:
  - Screenshots and large static images under `Belanet_Map_Improved/`
  - `Data/reports/*.json` generated artifacts
  - Legacy notes in `repo/` (superseded by `/docs`)
  - Temporary or debug utilities not referenced elsewhere
- **Checks before deletion**:
  - Inbound references count = 0 across codebase
  - Confirm not loaded dynamically by `server.js` or test harness
  - If in doubt, mark as "delete after refactor" with manual review required

### 7) Documentation Emission
- For each file/folder, render Markdown from templates with gathered metadata
- Maintain relative links and anchors between docs to mirror dependencies
- Create `docs/_index.md` summarizing the entire tree and key entry points
- Create `docs/_cleanup-report.md` listing all deletion candidates and justifications
- Write `docs/_coverage.json` with counts: total files, documented files, skipped (ignored/generated)

### 8) Safety and Idempotence
- Read-only analysis of source; only create/update content under `docs/`
- Re-run safe: completely regenerates docs deterministically
- Do not modify or delete any source files

## Source Structure Changes (Docs Only)
- Add a new top-level `docs/` directory that mirrors the repository
- No runtime/build behavior changes
- The legacy `repo/` directory is considered obsolete in favor of `docs/` but is not modified or removed

## Data Model / Interfaces
- **docs/<path>/<file>.md**: conforms to the File Template (sections 1–6)
- **docs/<path>/README.md**: conforms to the Folder Template (sections 1–5)
- **docs/_index.md**: repository-wide overview with links to all module/folder docs
- **docs/_cleanup-report.md**: table of candidates with reason, safety (now/later), and checks
- **docs/_coverage.json**: `{ totalFiles, documentedFiles, ignoredFiles, orphanAssets }`

## Verification Approach
1. Run the generator; ensure it respects `.gitignore` and produces only under `docs/`
2. Validate coverage: `totalFiles == documentedFiles + ignoredFiles`
3. Spot-check representative files:
   - `server.js` (entry server)
   - `map.html` (page-level integration)
   - `src/weather/WeatherOverlay.js` (feature module)
   - `User Interface/OperationalDashboard.js` (UI module)
   - `tests/*.spec.js` (test mapping)
4. Check reverse-dependency accuracy for several modules (inbound references)
5. Review `_cleanup-report.md` for correctness and justifications
6. Re-run generator to confirm idempotence (no diffs when unchanged)

## Risks & Mitigations
- **Dynamic requires/imports**: mark as heuristic and flag for manual review
- **Non-standard module patterns (UMD/inline globals)**: parse wrapper patterns and document inner API
- **Large binary assets**: do not inline; document metadata and usage only
- **False positives in deletion list**: include dependency checks and "delete after refactor" flags

## Tooling & Environment
- **Node.js**: 18+ recommended
- **Libraries**: `@babel/parser`, `cheerio`, `fast-glob` or `walkdir`
- **Execution**: one CLI script (e.g., `node tools/generate-docs.js`) writing to `docs/`
- **No test/lint changes**: focus on documentation generation and analysis only
