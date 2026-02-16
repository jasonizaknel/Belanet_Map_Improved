⚠ This folder is documented for audit and understanding only. Do not modify contents manually.

# .continue — Folder

- Name: .continue
- Path: ./.continue
- Type: Folder (tooling/config)

## Purpose & Responsibility
Holds configuration for a local workflow tool. Not part of application runtime.

## Contents Overview
- config.json — Tool configuration

## Dependency Graph
- None at runtime.

## Risk & Cleanup
- Keep as developer tooling; exclude from production packaging.
## Naming & Structural Consistency
- Consistency: mixed but generally coherent; standardize during refactor
- Case Styles: prefer kebab-case for files, camelCase for JS identifiers
- Normalization: align folder/file naming, collapse near-duplicates
- Import Paths: prefer relative paths consolidated via clear top-level entry points
