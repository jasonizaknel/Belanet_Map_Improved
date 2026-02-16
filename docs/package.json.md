# package.json — File

- Name: package.json
- Path: ./package.json
- Type: JSON (npm manifest)

## Purpose & Responsibility
Defines Node.js package metadata, scripts, and dependencies for the server and test tooling.

## Internal Structure
- `name`, `version`, `description`, `main` (server.js), `scripts.start`
- `dependencies`: axios, cheerio, dotenv, express, playwright, ws, xlsx
- `devDependencies`: @playwright/test

## Dependency Mapping
- Outbound: Pulls in libraries used by `server.js` and tests
- Inbound: Used by npm and tooling

## Bug & Risk Notes
- No scripts for tests or lint; add scripts for consistency in CI

## Deletion & Cleanup Suggestions
- None