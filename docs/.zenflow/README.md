⚠ This folder is documented for audit and understanding only. Do not modify contents manually.

# .zenflow — Folder

- Name: .zenflow
- Path: ./.zenflow
- Type: Folder (task automation artifacts)

## Purpose & Responsibility
Holds task specifications, plans, and reports for the Zenflow workflow used to manage coding tasks.

## Contents Overview
- tasks/ — Per-task `plan.md`, `spec.md`, and optional `report.md`

## Dependency Graph
- Not used by runtime; meta-level project management only.

## Risk & Cleanup
- Keep in VCS for provenance. Not part of production build.

## Naming & Structural Consistency
- Consistency: mixed but generally coherent; standardize during refactor
- Case Styles: prefer kebab-case for files, camelCase for JS identifiers
- Normalization: align folder/file naming, collapse near-duplicates
- Import Paths: prefer relative paths consolidated via clear top-level entry points
