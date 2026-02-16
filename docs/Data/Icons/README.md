# Data/Icons — Folder

- Name: Icons
- Path: ./Data/Icons
- Type: Folder (images)

## Purpose & Responsibility
Stores icon assets for markers and UI elements. Example: `NetworkTower.jpeg`, `icon.png`.

## Dependency Graph
- Potentially referenced by marker rendering logic; not directly imported in `map.html`

## Risk & Cleanup
- Keep optimized images only; remove unused assets after verifying references across JS/CSS/HTML.
## Naming & Structural Consistency
- Consistency: mixed but generally coherent; standardize during refactor
- Case Styles: prefer kebab-case for files, camelCase for JS identifiers
- Normalization: align folder/file naming, collapse near-duplicates
- Import Paths: prefer relative paths consolidated via clear top-level entry points
