# clock_manager.spec.js — Test

- Path: ./tests/clock_manager.spec.js
- Type: Playwright Test (Node, unit-style)

## Purpose & Responsibility
Validates ClockManager tick progression, rate changes, mode switching anchoring, hidden-tab cadence reduction, and timeSet behavior using a custom RAF harness.

## Dependencies
- @playwright/test; imports `../src/weather/ClockManager.js`
