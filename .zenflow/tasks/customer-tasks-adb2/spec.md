**Technical Context**
- **Stack**: Node.js (Express, WebSocket) backend; browser JavaScript frontend (single-page `map.html` with modules in `Marker Scripts/` and `User Interface/`)
- **Relevant Files**:
  - Backend: `server.js` (Express server, WebSocket, caches)
  - Frontend: `Marker Scripts/Markers.js`, `map.html`
  - Data: `Data/` directory stores JSON and spreadsheets
- **Dependencies**: `xlsx` available for CSV/XLSX parsing; no upload middleware installed (no `multer`).
- **Current Behavior**:
  - Backend fetches Splynx tasks via API and caches them (`tasksCache`).
  - `loadTaskIdsFromExcel()` reads `Data/Belanet Tasks Export.xlsx` for IDs only (not full file-based ingest).
  - Frontend calls `/api/tasks` and renders tasks; falls back to `Data/tasks.json` if API fails.

**Difficulty Assessment**
- **Medium**: Requires adding backend parsing endpoints, validation, and small UI controls to trigger imports, with attention to header-based mapping and deduplication.

**Implementation Approach**
- **Goal**: Support file-based import of open tasks from a locally stored or uploaded Splynx export (CSV/XLSX), with header-driven mapping, validation, deduplication, and UI-triggered refresh.

- **Backend Parsing Module (inside `server.js`)**
  - **Function**: `parseSplynxTasksFromFile(filePath)`
    - Detect by extension: `.csv` or Excel (`.xlsx`, `.xls`). Use `XLSX.readFile(filePath)` for both; for CSV, use `XLSX.readFile` + first sheet or `XLSX.read` with `type: 'file'` (library auto-detects).
    - Extract first worksheet → `XLSX.utils.sheet_to_json(worksheet, { header: 1 })` to get `rows: any[][]`.
    - Identify header row (first non-empty row). Build a case-insensitive map from header name → column index. Required headers: `ID`, `Title`. Optional: `Status`, `Customer`, `Created at`, `Updated at`.
    - For each data row after headers:
      - Read values by header indices. Trim strings.
      - Build a normalized task object:
        - `ID` (string/number coerced to string for identity)
        - `id` (numeric if parseable, else string)
        - `Title` (string)
        - `Status` (string; fallback to `"Unknown"`)
        - `Customer` (string; optional)
        - `CreatedAt` and `UpdatedAt` (ISO strings if parseable; also keep raw via `CreatedRaw`/`UpdatedRaw` if desired)
      - **Validation**: Skip rows missing `ID` or `Title` (collect `skipped` reasons).
    - **Deduplication**: Use a `Map` keyed by `ID` to keep the last occurrence. Return `{ tasks: Task[], stats: { totalRows, imported, duplicatesSkipped, invalidRows } }`.
    - **Header Validation**: If `ID` or `Title` headers not found → throw `Invalid Splynx task export format`.

  - **State Integration**
    - On successful parse, set `tasksCache.data = tasks` and `tasksCache.lastFetch = Date.now()`.
    - Optionally persist to `Data/tasks.json` for offline fallback used by `/api/tasks` (already present). Persistence is best-effort.

  - **Endpoints**
    - `GET /api/data-files` (admin-protected):
      - Lists files in `Data/` matching `*.csv`, `*.xlsx`, `*.xls`. Returns `{ files: string[] }` with basenames only.
    - `POST /api/tasks/import` (admin-protected):
      - JSON body: `{ filename: string }` where filename is a basename from `Data/`.
      - Validates path to ensure it resolves under `Data/` (no directory traversal).
      - Parses file via `parseSplynxTasksFromFile`.
      - Updates cache (and persists to `Data/tasks.json`).
      - Returns `{ imported, duplicatesSkipped, invalidRows, totalRows, tasksCount }`.
    - (Optional) `POST /api/tasks/upload` (admin-protected, minimal dependency):
      - Accepts `{ name: string, contentBase64: string }`; writes to `Data/` and then imports it. Avoids introducing new dependencies. Size-limit and basic content-type validation recommended.

  - **Security**
    - Reuse `adminAuth` middleware. Apply to `GET /api/data-files`, `POST /api/tasks/import`, and optional upload endpoint.
    - Ensure file path sanitization; only allow files under `Data/` with approved extensions.

- **Frontend Integration**
  - **UI Controls (in `map.html`)**
    - In the Tasks tab header, add an import control group:
      - Button `Import/Refresh Tasks`.
      - On click, fetch `/api/data-files` with `X-Admin-Token` header → render a dropdown of available files from `Data/`.
      - Selecting a file triggers `POST /api/tasks/import` with `{ filename }` and the same admin header.
      - On success, call existing `fetchTasks()` to refresh, then `mapTasksToCustomers()` and `renderGlobalTasksList()` (already called by `fetchTasks()`).
      - Show minimal inline feedback (success/error message near control, or console log if message area absent). Keep styling consistent with existing Tailwind classes.

  - **Markers.js**
    - Add `initTaskImportControls()` that wires the new UI elements and calls endpoints.
    - Call `initTaskImportControls()` once after DOM ready within existing initialization flow (`loadData()` already runs on load; controls can be initialized near tab setup).
    - No changes needed to task rendering; imported tasks expose `ID`, `Title`, `Status`, and `Customer` used by `getTaskStatusLabel`, `mapTasksToCustomers`, and task list rendering.

**Source Code Structure Changes**
- Modify `server.js`:
  - Add `parseSplynxTasksFromFile(filePath)`.
  - Add `GET /api/data-files` and `POST /api/tasks/import` routes using `adminAuth`.
  - Update `/api/tasks` to prefer `tasksCache.data` if set (already in place); no breaking changes.
- Modify `map.html`:
  - Add minimal import UI (button + dropdown container) within the Tasks tab section.
- Modify `Marker Scripts/Markers.js`:
  - Add `initTaskImportControls()` and small helpers to call backend endpoints and refresh tasks.
- Optional: write imported tasks to `Data/tasks.json` for existing fallback logic.

**Data Model / Interface Changes**
- Backend task object (normalized):
  - `ID` (string identity), `id` (number or string), `Title` (string), `Status` (string), `Customer` (string|undefined), `CreatedAt` (ISO|undefined), `UpdatedAt` (ISO|undefined)
- API Contracts:
  - `GET /api/data-files` → `{ files: string[] }`
  - `POST /api/tasks/import` → `{ imported, duplicatesSkipped, invalidRows, totalRows, tasksCount }`
  - `GET /api/tasks` → unchanged; returns `Task[]`
- Frontend expects `ID|id`, `Title`, `Status`, `Customer` (existing code paths already handle these keys).

**Validation & Error Handling**
- Skip rows missing `ID` or `Title`.
- Collect and log malformed rows; include counts in response.
- Header validation with a clear message: `Invalid Splynx task export format` when required headers absent.
- Deduplicate by `ID`.

**Verification Approach**
- **Server**
  - Place a valid export in `Data/` (CSV and XLSX variants) with headers: `ID,Title,Status,Customer,Created at,Updated at` (order arbitrary).
  - Call `GET /api/data-files` with `X-Admin-Token` → verify listed files.
  - Call `POST /api/tasks/import` with `{ filename }` → verify response stats and `tasksCache` is populated (subsequent `GET /api/tasks` returns imported tasks).
  - Retry import with a modified file → verify `/api/tasks` reflects refreshed data and duplicates are not multiplied.
  - Corrupt headers (e.g., remove `Title`) → verify 400 with `Invalid Splynx task export format` and server does not crash.

- **Frontend**
  - Open app, go to Tasks tab.
  - Use Import/Refresh control to choose a file → confirm task list updates, count badge changes, and tasks map to customers when `Customer` name matches `Data/customers.json` entries.
  - Re-import another file → confirm tasks refresh without duplicates.

- **Edge Cases**
  - Empty file or only headers → zero tasks with graceful messaging.
  - Mixed date formats → `CreatedAt/UpdatedAt` best-effort ISO conversion; raw strings preserved if needed (not used by UI today).
  - Large files → acceptable performance with `xlsx` parsing; operations remain synchronous per request.

**Notes & Constraints**
- Upload support provided via optional base64 endpoint to avoid adding new dependencies.
- All admin operations guarded by `adminAuth` and limited to `Data/` directory.
