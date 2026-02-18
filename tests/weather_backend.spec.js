const { test, expect } = require('@playwright/test');
const path = require('path');

function makeUpstream(okJson) {
  let calls = 0;
  const fetchWithRetry = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      async json() { return typeof okJson === 'function' ? okJson(calls) : okJson; },
    };
  };
  fetchWithRetry.calls = () => calls;
  return fetchWithRetry;
}

function patchHttp(mock) {
  const httpPath = path.resolve(__dirname, '../lib/http.js');
  const mod = require(httpPath);
  const orig = { ...mod };
  require.cache[require.resolve(httpPath)].exports.fetchWithRetry = mock;
  return () => { require.cache[require.resolve(httpPath)].exports = orig; };
}

function sampleOneCall(lat = -25.0, lon = 28.0) {
  const now = Math.floor(Date.now() / 1000);
  return {
    lat, lon,
    timezone: 'Africa/Johannesburg',
    timezone_offset: 7200,
    current: { dt: now, temp: 20, feels_like: 20, pressure: 1012, humidity: 50, dew_point: 10, uvi: 0, clouds: 0, visibility: 10000, wind_speed: 3, wind_deg: 90, weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }] },
    hourly: [ { dt: now, temp: 20, feels_like: 20, pressure: 1012, humidity: 50, dew_point: 10, uvi: 0, clouds: 0, visibility: 10000, wind_speed: 3, wind_deg: 90, pop: 0, weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }] } ],
    daily: [ { dt: now, sunrise: now+21600, sunset: now+64800, temp: { day: 20, min: 12, max: 26, night: 14, eve: 22, morn: 12 }, feels_like: { day: 20, night: 14, eve: 22, morn: 12 }, pressure: 1012, humidity: 50, dew_point: 10, wind_speed: 3, wind_deg: 90, clouds: 0, pop: 0, rain: 0, uvi: 0, weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }] } ],
  };
}

const { snapshot } = require('../lib/metrics');

test.describe('WeatherBackend (server cache)', () => {
  test('cache hit and TTL expiration', async () => {
    const mock = makeUpstream(sampleOneCall());
    const undo = patchHttp(mock);
    const { WeatherBackend } = require('../services/WeatherBackend');
    try {
      const wb = new WeatherBackend({ apiKey: 'k', coordTtlMs: 20, enable: true, dataDir: path.resolve(__dirname, '..') });
      const a = await wb.oneCall(-25.01, 28.02);
      expect(a._meta && a._meta.source).toBe('network');

      const b = await wb.oneCall(-25.01, 28.02);
      expect(b._meta && b._meta.source).toBe('cache');
      expect(mock.calls()).toBe(1);

      await new Promise(r => setTimeout(r, 30));
      const c = await wb.oneCall(-25.01, 28.02);
      expect(c._meta && c._meta.source).toBe('network');
      expect(mock.calls()).toBe(2);
    } finally {
      undo();
    }
  });

  test('quota enforcement returns 429 after limit reached', async () => {
    const mock = makeUpstream(sampleOneCall());
    const undo = patchHttp(mock);
    const { WeatherBackend } = require('../services/WeatherBackend');
    try {
      const wb = new WeatherBackend({ apiKey: 'k', coordTtlMs: 1, enable: true, dataDir: path.resolve(__dirname, '..') });
      await wb.setLimit(1);
      const a = await wb.oneCall(-25.0, 28.0);
      expect(a && a.current && typeof a.current.temp === 'number').toBeTruthy();
      let err = null;
      try { await wb.oneCall(-25.23, 28.23); } catch (e) { err = e; }
      expect(err && err.status).toBe(429);
    } finally {
      undo();
    }
  });

  test('metrics counters increment for fetches and integration success', async () => {
    const mock = makeUpstream(sampleOneCall());
    const undo = patchHttp(mock);
    const { WeatherBackend } = require('../services/WeatherBackend');
    try {
      const wb = new WeatherBackend({ apiKey: 'k', coordTtlMs: 50, enable: true, dataDir: path.resolve(__dirname, '..') });
      const before = snapshot();
      await wb.oneCall(-25.0, 28.0);
      const after = snapshot();
      const keys = Object.keys(after.counters);
      const hasFetch = keys.some(k => k.startsWith('weather_fetch_total|') && /route=\/api\/onecall/.test(k));
      const hasIntegration = keys.some(k => k.startsWith('integration_calls_total|') && k.includes('op=onecall') && k.includes('service=openweather') && k.includes('status=success'));
      expect(hasFetch).toBeTruthy();
      expect(hasIntegration).toBeTruthy();
    } finally {
      undo();
    }
  });
});
