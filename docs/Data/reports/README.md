# Data/reports — Folder

- Name: reports
- Path: ./Data/reports
- Type: Folder (generated JSON)

## Purpose & Responsibility
Holds simulation and operational JSON reports produced during runs. Files are timestamped and not intended for source control.

## Dependency Graph
- Not imported by runtime code; used for offline analysis or historical reference.

## Risk & Cleanup
- Safe to delete; mark as generated artifacts. Ensure `.gitignore` excludes these paths if retention in VCS is not desired.