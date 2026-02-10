const { test, expect } = require('@playwright/test');
const path = require('path');
const WeatherService = require(path.resolve(__dirname, '../src/weather/WeatherService.js'));

function makeResponse({ ok = true, status = 200, json = {}, text = '' }) {
  return {
    ok,
    status,
    async json() { return json; },
    async text() { return text || (typeof json === 'object' ? JSON.stringify(json) : String(json)); },
  };
}

function makeFetchSequence(seq) {
  let i = 0;
  const fn = async () => {
    const cur = seq[Math.min(i, seq.length - 1)];
    i += 1;
    if (cur instanceof Error) throw cur;
    return makeResponse(cur);
  };
  fn.calls = () => i;
  return fn;
}

function sampleOneCall({ start = 1_700_000_000 } = {}) {
  const hourly = Array.from({ length: 6 }, (_, j) => ({
    dt: start + j * 3600,
    temp: j * 3,
    feels_like: j * 3,
    pressure: 1000 + j,
    humidity: 50 + j,
    dew_point: 5 + j,
    uvi: 0,
    clouds: j * 10,
    visibility: 10000,
    wind_speed: j + 1,
    wind_deg: 90,
    wind_gust: j + 1.5,
    pop: 0.1 * (j + 1),
    rain: { '1h': j % 3 === 0 ? 1 : 0 },
    weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  }));

  const daily = [
    {
      dt: start,
      sunrise: start + 6 * 3600,
      sunset: start + 18 * 3600,
      moonrise: start + 20 * 3600,
      moonset: start + 7 * 3600,
      moon_phase: 0.5,
      temp: { day: 20, min: 12, max: 26, night: 14, eve: 22, morn: 12 },
      feels_like: { day: 20, night: 14, eve: 22, morn: 12 },
      pressure: 1008,
      humidity: 60,
      dew_point: 10,
      wind_speed: 4,
      wind_deg: 100,
      wind_gust: 6,
      clouds: 10,
      pop: 0.2,
      rain: 1,
      uvi: 5,
      weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
    },
  ];

  return {
    lat: -33.9,
    lon: 18.4,
    timezone: 'Africa/Johannesburg',
    timezone_offset: 7200,
    current: {
      dt: start,
      sunrise: start + 6 * 3600,
      sunset: start + 18 * 3600,
      temp: 18,
      feels_like: 18,
      pressure: 1012,
      humidity: 55,
      dew_point: 10,
      uvi: 2,
      clouds: 0,
      visibility: 10000,
      wind_speed: 3,
      wind_deg: 45,
      wind_gust: 5,
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      rain: { '1h': 0 },
    },
    hourly,
    daily,
  };
}

test.describe('WeatherService', () => {
  test('normalization returns expected structure', async () => {
    const fetcher = makeFetchSequence([{ ok: true, status: 200, json: sampleOneCall() }]);
    const svc = new WeatherService({ apiKey: 'k', fetcher, ttl: 60_000 });
    const data = await svc.fetchOneCall({ lat: -33.9, lon: 18.4 });
    expect(data.lat).toBe(-33.9);
    expect(data.lon).toBe(18.4);
    expect(data.current).toBeTruthy();
    expect(Array.isArray(data.hourly)).toBeTruthy();
    expect(Array.isArray(data.daily)).toBeTruthy();
    expect(data._meta.stale).toBeFalsy();
    expect(data._meta.source).toBe('network');
    expect(fetcher.calls()).toBe(1);
  });

  test('3-hour resampling aggregates correctly', async () => {
    const base = 1_700_000_000;
    const fetcher = makeFetchSequence([{ ok: true, status: 200, json: sampleOneCall({ start: base }) }]);
    const svc = new WeatherService({ apiKey: 'k', fetcher, ttl: 60_000 });
    const res = await svc.getHourly3h(-33.9, 18.4);
    expect(res.list.length).toBe(2); // 6 hours -> 2 buckets
    const b0 = res.list[0];
    const b1 = res.list[1];
    expect(b0.dt).toBe(base); // rounded down
    // temps 0,3,6 -> avg = 3
    expect(Math.round(b0.temp)).toBe(3);
    // rain1h 1,0,0 -> sum = 1 over 3h
    expect(b0.rain['3h']).toBe(1);
    // second bucket 9,12,15 -> avg = 12
    expect(Math.round(b1.temp)).toBe(12);
    // pops 0.4,0.5,0.6 -> avg ~0.5
    expect(Math.round(b1.pop * 10)).toBe(5);
  });

  test('caching returns cached result then revalidates after TTL', async () => {
    const fetcher = makeFetchSequence([
      { ok: true, status: 200, json: sampleOneCall() },
      { ok: true, status: 200, json: sampleOneCall() },
    ]);
    const svc = new WeatherService({ apiKey: 'k', fetcher, ttl: { current: 10, hourly: 10, daily: 10 } });

    const a = await svc.getCurrent(-33.9, 18.4);
    expect(a._meta.source).toBe('network');

    const b = await svc.getCurrent(-33.9, 18.4);
    expect(b._meta.source).toBe('cache');
    expect(b._meta.stale).toBeFalsy();

    await new Promise((r) => setTimeout(r, 15));
    const c = await svc.getCurrent(-33.9, 18.4);
    expect(c._meta.source).toBe('cache');
    expect(c._meta.stale).toBeTruthy();

    await new Promise((r) => setTimeout(r, 30));
    expect(fetcher.calls()).toBeGreaterThanOrEqual(2);
  });

  test('retry/backoff on 5xx then success', async () => {
    const seq = [
      { ok: false, status: 503, json: { m: 'down' } },
      { ok: false, status: 502, json: { m: 'bad' } },
      { ok: true, status: 200, json: sampleOneCall() },
    ];
    const fetcher = makeFetchSequence(seq);
    const svc = new WeatherService({ apiKey: 'k', fetcher, ttl: 60_000 });
    const data = await svc.fetchOneCall({ lat: -33.9, lon: 18.4 });
    expect(data._meta.source).toBe('network');
    expect(fetcher.calls()).toBe(3);
  });

  test('throws categorized errors for 401 and 429', async () => {
    const fetcher401 = makeFetchSequence([{ ok: false, status: 401, json: { cod: 401, message: 'Invalid API key' } }]);
    const svc401 = new WeatherService({ apiKey: 'bad', fetcher: fetcher401, ttl: 60_000 });
    await expect(svc401.fetchOneCall({ lat: 0, lon: 0 })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    const fetcher429 = makeFetchSequence([{ ok: false, status: 429, json: { cod: 429, message: 'rate limit' } }]);
    const svc429 = new WeatherService({ apiKey: 'k', fetcher: fetcher429, ttl: 60_000 });
    await expect(svc429.fetchOneCall({ lat: 0, lon: 0 })).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  });
});
