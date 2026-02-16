# test_tasks.js — File

- Name: test_tasks.js
- Path: ./test_tasks.js
- Type: JavaScript (Node.js)

## Purpose & Responsibility
Fetches tasks from Splynx API using hard-coded credentials, logs counts. Likely a one-off test.

## Internal Structure
- Builds Basic auth from constants, fetches `/api/2.0/admin/scheduling/tasks`, logs response (lines ~1–36)

## Dependency Mapping
- Outbound: global `fetch`

## Bug & Risk Notes
- Contains credentials in source; remove secrets immediately and move to `.env`

## Deletion & Cleanup Suggestions
- Strong candidate for deletion or sanitization; replace with environment-driven script.

## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
