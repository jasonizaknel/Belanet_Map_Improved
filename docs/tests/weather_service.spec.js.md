# weather_service.spec.js — Test

- Path: ./tests/weather_service.spec.js
- Type: Playwright Test (Node, unit-style)

## Purpose & Responsibility
Unit-like tests for WeatherService normalization, caching/TTL, resampling to 3h buckets, retry/backoff, and error categorization.

## Dependencies
- @playwright/test; imports `../src/weather/WeatherService.js`

## Notes
- Uses mocked fetch sequences and helpers to simulate responses/latency.