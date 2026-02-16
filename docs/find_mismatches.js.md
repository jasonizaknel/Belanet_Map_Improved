# find_mismatches.js — File

- Name: find_mismatches.js
- Path: ./find_mismatches.js
- Type: JavaScript (Node.js)

## Purpose & Responsibility
Analyzes tower vs service login mappings and lists customers without links by cross-referencing Data JSON files.

## Internal Structure
- Reads JSON: `Data/highsite.json`, `Data/servicelogin.json`, `Data/servicesId.json`, `Data/customers.json`
- Heuristically matches login sites to towers; prints unmatched and customers with no links (lines ~4–70)

## Dependency Mapping
- Outbound: Node `fs`

## Bug & Risk Notes
- Assumes file presence and formats; add guards before productionizing

## Deletion & Cleanup Suggestions
- Keep as analysis script; safe to remove if folded into app logic.
## Refactor Notes
- Candidates for extraction:
- Candidates for merge:
- Known inefficiencies:
- Rename or relocation suggestions:
