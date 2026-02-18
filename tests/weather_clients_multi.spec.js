const { test, expect } = require('@playwright/test');
const path = require('path');

async function injectScripts(page) {
  await page.addScriptTag({ path: path.resolve(__dirname, '../src/weather/WeatherService.js') });
}

test.describe('Multiple clients consistency (server-owned semantics)', () => {
  test('two clients receive consistent data and server _meta', async ({ browser }) => {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    const PORT = Number(process.env.PORT || 5505);
    const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;
    await Promise.all([pageA.goto(BASE + '/map.html'), pageB.goto(BASE + '/map.html')]);
    await Promise.all([injectScripts(pageA), injectScripts(pageB)]);

    const result = await Promise.all([pageA, pageB].map(async (p, idx) => {
      return p.evaluate(async (id) => {
        const WeatherService = window.WeatherService;
        let calls = 0;
        const fetcher = async () => {
          calls += 1;
          const payload = {
            lat: -25, lon: 28,
            timezone: 'Africa/Johannesburg', timezone_offset: 7200,
            current: { dt: 1700000000, temp: 21, pressure: 1010, humidity: 50, uvi: 0, clouds: 0, wind_speed: 2, wind_deg: 90, weather: { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' } },
            hourly: [], daily: [],
            _meta: { ts: Date.now(), stale: false, source: calls === 1 ? 'network' : 'cache', ttl_ms: 60000, key: '-25.00,28.00' }
          };
          return {
            ok: true,
            status: 200,
            headers: { get: (k) => ({ 'X-Weather-Quota-Used': '42', 'X-Weather-Quota-Limit': '500', 'X-Weather-Source': calls === 1 ? 'network' : 'cache', 'X-Weather-Key': '-25.00,28.00' })[k] || null },
            async json() { return payload; },
            async text() { return JSON.stringify(payload); },
          };
        };

        const svc = new WeatherService({ baseUrl: '/api/onecall', fetcher, ttl: 60_000 });
        const data1 = await svc.fetchOneCall({ lat: -25, lon: 28 });
        const data2 = await svc.fetchOneCall({ lat: -25, lon: 28 });
        return { id, m1: data1._meta, m2: data2._meta, used: svc.getApiCallsUsed(), limit: svc.getApiCallLimit() };
      }, idx);
    }));

    expect(result[0].m1.key).toBe(result[1].m1.key);
    expect(result[0].m1.source).toBe('network');
    expect(result[1].m1.source).toBe('network');
    expect(result[0].m2.source).toBe('cache');
    expect(result[1].m2.source).toBe('cache');
    expect(result[0].used).toBe(42);
    expect(result[1].used).toBe(42);
  });
});
