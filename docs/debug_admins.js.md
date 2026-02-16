# debug_admins.js — File

- Name: debug_admins.js
- Path: ./debug_admins.js
- Type: JavaScript (Node.js)

## Purpose & Responsibility
Debug utility to fetch Splynx administrators using read-only credentials and log the response.

## Internal Structure
- Builds Basic auth header from `SPLYNX_READ_ONLY_KEY/SECRET`, logs status and raw text (lines ~6–35)

## Dependency Mapping
- Outbound: global `fetch` assumed; consider `node-fetch` in Node contexts

## Bug & Risk Notes
- Requires credentials; ensure secrets are not committed

## Deletion & Cleanup Suggestions
- Safe to delete if not used; otherwise add to tooling scripts.