const { test, expect } = require('@playwright/test');
const path = require('path');
const WeatherService = require(path.resolve(__dirname, '../src/weather/WeatherService.js'));

function makeResponseWithHeaders({ ok = true, status = 200, json = {}, headers = {} }) {
  return {
    ok,
    status,
    headers: { get: (k) => headers[k] || headers[k.toLowerCase()] || null },
    async json() { return json; },
    async text() { return JSON.stringify(json); },
  };
}

test.describe('WeatherService with server metadata', () => {
  test('propagates _meta from server and tracks quota headers', async () => {
    const payload = {
      lat: -25, lon: 28,
      timezone: 'Africa/Johannesburg', timezone_offset: 7200,
      current: { dt: 1700000000, temp: 21, pressure: 1010, humidity: 50, uvi: 0, clouds: 0, wind_speed: 2, wind_deg: 90, weather: { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' } },
      hourly: [], daily: [],
      _meta: { ts: Date.now(), stale: false, source: 'cache', ttl_ms: 60000, key: '-25.00,28.00' }
    };

    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return makeResponseWithHeaders({
        ok: true,
        status: 200,
        json: payload,
        headers: { 'X-Weather-Quota-Used': '12', 'X-Weather-Quota-Limit': '500', 'X-Weather-Source': 'cache', 'X-Weather-Key': '-25.00,28.00' },
      });
    };

    const svc = new WeatherService({ baseUrl: '/api/onecall', fetcher, ttl: 60_000 });
    const data = await svc.fetchOneCall({ lat: -25, lon: 28 });
    expect(data._meta && data._meta.source).toBe('cache');
    expect(svc.getApiCallsUsed()).toBe(12);
    expect(svc.getApiCallLimit()).toBe(500);
    expect(calls).toBe(1);
  });
});
