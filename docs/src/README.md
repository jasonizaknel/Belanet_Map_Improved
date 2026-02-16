# src — Folder

- Name: src
- Path: ./src
- Type: Folder (source modules)

## Purpose & Responsibility
Holds modularized features not tied to legacy folder structure. Currently used for Weather overlay feature.

## Contents Overview
- weather/ — Weather overlay UI, service, and clock manager

## Dependency Graph
- Imported in `map.html` and dynamically by Marker scripts

## Risk & Cleanup
- None specific; good candidate for further modularization.
## Naming & Structural Consistency
- Consistency: mixed but generally coherent; standardize during refactor
- Case Styles: prefer kebab-case for files, camelCase for JS identifiers
- Normalization: align folder/file naming, collapse near-duplicates
- Import Paths: prefer relative paths consolidated via clear top-level entry points
