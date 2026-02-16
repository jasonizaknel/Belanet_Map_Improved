⚠ This folder is documented for audit and understanding only. Do not modify contents manually.

# .zenflow/tasks — Folder

- Name: tasks
- Path: ./.zenflow/tasks
- Type: Folder (task artifacts)

## Purpose & Responsibility
Per-task directories containing `spec.md`, `plan.md`, and optionally `report.md` for various repository maintenance and feature tasks.

## Contents Overview
- customer-tasks-adb2/
- repo-context-update-9743/
- repository-wide-documentation-408f/
- task-dashboard-ui-workflow-f9e1/
- weather-overlay-9d8b/
- weather-overlay-c957/
- weather-overlay-fix-9994/

## Dependency Graph
- None at runtime. Inputs for agents and maintainers.

## Risk & Cleanup
- None. Retain history for auditability.

## Naming & Structural Consistency
- Consistency: mixed but generally coherent; standardize during refactor
- Case Styles: prefer kebab-case for files, camelCase for JS identifiers
- Normalization: align folder/file naming, collapse near-duplicates
- Import Paths: prefer relative paths consolidated via clear top-level entry points
