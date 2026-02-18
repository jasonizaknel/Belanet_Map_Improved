(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WeatherService = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_BASE_URL = '/api/onecall';

  class InMemoryStorage {
    constructor() {
      this._map = new Map();
    }
    getItem(k) {
      const v = this._map.get(k);
      return v == null ? null : v;
    }
    setItem(k, v) {
      this._map.set(k, String(v));
    }
    removeItem(k) {
      this._map.delete(k);
    }
  }

  class Emitter {
    constructor(){ this._m=new Map(); }
    on(t,fn){ if(!this._m.has(t)) this._m.set(t,new Set()); this._m.get(t).add(fn); return ()=>this.off(t,fn); }
    off(t,fn){ const s=this._m.get(t); if(!s) return; s.delete(fn); if(s.size===0) this._m.delete(t); }
    emit(t,v){ const s=this._m.get(t); if(!s) return; for(const fn of Array.from(s)){ try{ fn(v);}catch(_){}} }
  }

  class WeatherServiceError extends Error {
    constructor(message, code, status) {
      super(message);
      this.name = 'WeatherServiceError';
      this.code = code;
      this.status = status;
    }
  }

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function jitter(base) {
    const r = Math.random() * 0.4 + 0.8;
    return Math.round(base * r);
  }

  function isLocalStorageLike(obj) {
    return obj && typeof obj.getItem === 'function' && typeof obj.setItem === 'function' && typeof obj.removeItem === 'function';
  }

  function toStorage(storage) {
    if (isLocalStorageLike(storage)) return storage;
    if (typeof localStorage !== 'undefined' && isLocalStorageLike(localStorage)) return localStorage;
    return new InMemoryStorage();
  }

  function safeJsonParse(s) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function avg(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function sum(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0);
  }

  function toNumber(x, fallback = 0){ const n = Number(x); return Number.isFinite(n) ? n : fallback; }

  function pickWeather(w) {
    if (Array.isArray(w) && w.length) return w[0];
    return w || null;
  }

  function normalizeCurrent(c) {
    if (!c) return null;
    const rain = c.rain && (c.rain['1h'] || c.rain['3h']) ? { '1h': c.rain['1h'] || 0, '3h': c.rain['3h'] || 0 } : undefined;
    const snow = c.snow && (c.snow['1h'] || c.snow['3h']) ? { '1h': c.snow['1h'] || 0, '3h': c.snow['3h'] || 0 } : undefined;
    return {
      dt: c.dt,
      sunrise: c.sunrise || null,
      sunset: c.sunset || null,
      temp: c.temp,
      feels_like: c.feels_like,
      pressure: c.pressure,
      humidity: c.humidity,
      dew_point: c.dew_point,
      uvi: c.uvi,
      clouds: c.clouds,
      visibility: c.visibility,
      wind_speed: c.wind_speed,
      wind_deg: c.wind_deg,
      wind_gust: c.wind_gust || null,
      rain,
      snow,
      weather: pickWeather(c.weather),
    };
  }

  function normalizeHourly(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((h) => {
      const rain = h.rain && (h.rain['1h'] || h.rain['3h']) ? { '1h': h.rain['1h'] || 0, '3h': h.rain['3h'] || 0 } : undefined;
      const snow = h.snow && (h.snow['1h'] || h.snow['3h']) ? { '1h': h.snow['1h'] || 0, '3h': h.snow['3h'] || 0 } : undefined;
      return {
        dt: h.dt,
        temp: h.temp,
        feels_like: h.feels_like,
        pressure: h.pressure,
        humidity: h.humidity,
        dew_point: h.dew_point,
        uvi: h.uvi || 0,
        clouds: h.clouds,
        visibility: h.visibility || null,
        wind_speed: h.wind_speed,
        wind_deg: h.wind_deg,
        wind_gust: h.wind_gust || null,
        pop: h.pop || 0,
        rain,
        snow,
        weather: pickWeather(h.weather),
      };
    });
  }

  function normalizeDaily(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((d) => {
      return {
        dt: d.dt,
        sunrise: d.sunrise || null,
        sunset: d.sunset || null,
        moonrise: d.moonrise || null,
        moonset: d.moonset || null,
        moon_phase: d.moon_phase || null,
        temp: d.temp,
        feels_like: d.feels_like,
        pressure: d.pressure,
        humidity: d.humidity,
        dew_point: d.dew_point,
        wind_speed: d.wind_speed,
        wind_deg: d.wind_deg,
        wind_gust: d.wind_gust || null,
        clouds: d.clouds,
        pop: d.pop || 0,
        rain: d.rain || 0,
        snow: d.snow || 0,
        uvi: d.uvi || 0,
        weather: pickWeather(d.weather),
      };
    });
  }

  function roundDownTo3h(epochSec) {
    const threeHours = 3 * 3600;
    return Math.floor(epochSec / threeHours) * threeHours;
  }

  function resampleHourlyTo3h(hourly) {
    if (!Array.isArray(hourly) || hourly.length === 0) return [];
    const buckets = new Map();
    const anchor = hourly[0].dt;
    const window = 3 * 3600;
    for (const h of hourly) {
      const key = anchor + Math.floor((h.dt - anchor) / window) * window;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(h);
    }
    const out = [];
    const keys = Array.from(buckets.keys()).sort((a, b) => a - b);
    for (const k of keys) {
      const arr = buckets.get(k);
      out.push(aggregate3h(k, arr));
    }
    return out;
  }

  function aggregate3h(dt, arr) {
    const temps = arr.map((x) => x.temp).filter((x) => typeof x === 'number');
    const feels = arr.map((x) => x.feels_like).filter((x) => typeof x === 'number');
    const winds = arr.map((x) => x.wind_speed).filter((x) => typeof x === 'number');
    const gusts = arr.map((x) => x.wind_gust).filter((x) => typeof x === 'number');
    const hums = arr.map((x) => x.humidity).filter((x) => typeof x === 'number');
    const clouds = arr.map((x) => x.clouds).filter((x) => typeof x === 'number');
    const pops = arr.map((x) => x.pop).filter((x) => typeof x === 'number');
    const rains1h = arr.map((x) => (x.rain && x.rain['1h']) || 0);
    const snows1h = arr.map((x) => (x.snow && x.snow['1h']) || 0);
    const weather = arr.find((x) => x.weather) ? arr.find((x) => x.weather).weather : null;
    return {
      dt,
      temp: avg(temps),
      feels_like: avg(feels),
      wind_speed: avg(winds),
      wind_gust: gusts.length ? avg(gusts) : null,
      humidity: avg(hums),
      clouds: avg(clouds),
      pop: avg(pops),
      rain: { '3h': sum(rains1h) },
      snow: { '3h': sum(snows1h) },
      weather,
    };
  }

  class WeatherService {
    constructor(options = {}) {
      const {
        apiKey,
        baseUrl = DEFAULT_BASE_URL,
        ttl = { current: 5 * 60_000, hourly: 10 * 60_000, daily: 60 * 60_000 },
        storage,
        units = 'metric',
        lang = 'en',
        fetcher = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null),
      } = options;

      if (!apiKey && !(typeof baseUrl === 'string' && baseUrl.startsWith('/'))) {
        throw new WeatherServiceError('Missing apiKey', 'CONFIG');
      }
      if (!fetcher) {
        throw new WeatherServiceError('Missing fetch implementation', 'CONFIG');
      }

      this.apiKey = apiKey;
      this.baseUrl = baseUrl;
      this.units = units;
      this.lang = lang;
      this._ttl = typeof ttl === 'number' ? { current: ttl, hourly: ttl, daily: ttl } : ttl;
      this._storage = toStorage(storage);
      this._fetch = fetcher;
      this._mem = new Map();
      this._em = new Emitter();
      this._apiCallsUsed = 0;
      this._apiCallLimit = 500;
      this._loadApiCallStats();
      try { if (!globalThis.__WEATHER_DUP_WARNED) { console.warn('[Weather] Client cache is advisory; server cache is authoritative for now'); console.info('[Weather] Client TTLs', { current_ms: this._ttlFor('current'), hourly_ms: this._ttlFor('hourly'), daily_ms: this._ttlFor('daily') }); globalThis.__WEATHER_DUP_WARNED = true; } } catch(_) {}
    }

    _ttlFor(kind) {
      const t = this._ttl && this._ttl[kind];
      return typeof t === 'number' ? t : 10 * 60_000;
    }

    _storageKey(kind, key) {
      return `WeatherService:${kind}:${key}`;
    }

    _now() {
      return Date.now();
    }

    _isServerBase() {
      return typeof this.baseUrl === 'string' && this.baseUrl.startsWith('/');
    }

    on(t,fn){ return this._em.on(t,fn); }
    off(t,fn){ return this._em.off(t,fn); }

    getApiCallsUsed() {
      return this._apiCallsUsed;
    }

    getApiCallLimit() {
      return this._apiCallLimit;
    }

    setApiCallLimit(limit) {
      const newLimit = Math.max(1, parseInt(limit, 10) || 500);
      this._apiCallLimit = newLimit;
      this._em.emit('api_call_limit_changed', { limit: newLimit });
    }

    isApiCallLimitReached() {
      return this._apiCallsUsed >= this._apiCallLimit;
    }

    _incrementApiCallCount() {
      this._apiCallsUsed += 1;
      this._saveApiCallStats();
      this._em.emit('api_call_count_changed', { callsUsed: this._apiCallsUsed, limit: this._apiCallLimit });
      if (this.isApiCallLimitReached()) {
        this._em.emit('api_call_limit_reached', { callsUsed: this._apiCallsUsed, limit: this._apiCallLimit });
      }
    }

    resetApiCallCount() {
      this._apiCallsUsed = 0;
      this._saveApiCallStats();
      this._em.emit('api_call_count_reset', { callsUsed: 0, limit: this._apiCallLimit });
    }

    _saveApiCallStats() {
      const stats = { callsUsed: this._apiCallsUsed, limit: this._apiCallLimit };
      try {
        this._storage.setItem('WeatherService:api_call_stats', JSON.stringify(stats));
      } catch (_) {
        // Silently fail if storage is unavailable
      }
    }

    _loadApiCallStats() {
      try {
        const raw = this._storage.getItem('WeatherService:api_call_stats');
        if (raw) {
          const stats = JSON.parse(raw);
          if (typeof stats.callsUsed === 'number') {
            this._apiCallsUsed = stats.callsUsed;
          }
          if (typeof stats.limit === 'number') {
            this._apiCallLimit = stats.limit;
          }
        }
      } catch (_) {
        // Silently fail if parsing fails
      }
    }

    async _requestJson(url, { retries = 3, retryBase = 300 } = {}) {
      let lastErr;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          this._em.emit('request',{url,attempt});
          const res = await this._fetch(url, { headers: { 'Accept': 'application/json' } });
          if (!res) throw new WeatherServiceError('No response', 'NETWORK');
          this._em.emit('response',{url,status:res.status,ok:res.ok});
          if (res.ok) {
            try { if (typeof navigator!=='undefined' && navigator.sendBeacon) { const body = new Blob([JSON.stringify({ name: 'weather_fetch_total', labels: { source: 'client', base: (this.baseUrl && typeof this.baseUrl==='string' && this.baseUrl.startsWith('/')) ? 'server' : 'openweather' }, by: 1 })], { type: 'application/json' }); navigator.sendBeacon('/api/metrics/inc', body); } else if (typeof fetch!=='undefined') { fetch('/api/metrics/inc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'weather_fetch_total', labels: { source: 'client', base: (this.baseUrl && typeof this.baseUrl==='string' && this.baseUrl.startsWith('/')) ? 'server' : 'openweather' }, by: 1 }) }).catch(()=>{}); } } catch(_) {}
            try { if (res.headers && typeof res.headers.get==='function') { const used = Number(res.headers.get('X-Weather-Quota-Used')); const limit = Number(res.headers.get('X-Weather-Quota-Limit')); if (Number.isFinite(used)) { this._apiCallsUsed = used; } if (Number.isFinite(limit) && limit>0) { this._apiCallLimit = limit; } } } catch(_) {}
            return await res.json();
          }
          if (res.status === 401) {
            const e=new WeatherServiceError('Unauthorized (invalid API key)', 'UNAUTHENTICATED', 401); this._em.emit('error',e); throw e;
          }
          if (res.status === 429) {
            if (attempt < retries) {
              await sleep(jitter(retryBase * Math.pow(2, attempt)));
              continue;
            }
            const e=new WeatherServiceError('Rate limited', 'RATE_LIMIT', 429); this._em.emit('error',e); throw e;
          }
          if (res.status >= 500) {
            if (attempt < retries) {
              await sleep(jitter(retryBase * Math.pow(2, attempt)));
              continue;
            }
            const e=new WeatherServiceError(`Server error ${res.status}`, 'SERVER', res.status); this._em.emit('error',e); throw e;
          }
          const text = await res.text().catch(() => '');
          const e=new WeatherServiceError(`HTTP ${res.status}: ${text || 'Unknown error'}`,'HTTP', res.status); this._em.emit('error',e); throw e;
        } catch (err) {
          lastErr = err;
          if (err instanceof WeatherServiceError && ['UNAUTHENTICATED','RATE_LIMIT','SERVER','HTTP'].includes(err.code)) {
            throw err;
          }
          if (attempt < retries) {
            await sleep(jitter(retryBase * Math.pow(2, attempt)));
            continue;
          }
          const e=new WeatherServiceError(err && err.message ? err.message : 'Network error', 'NETWORK'); this._em.emit('error',e); throw e;
        }
      }
      throw lastErr || new WeatherServiceError('Unknown error', 'UNKNOWN');
    }

    _composeUrl(params) {
      const p = new URLSearchParams();
      p.set('lat', String(params.lat));
      p.set('lon', String(params.lon));
      if (params.exclude) p.set('exclude', params.exclude);
      if (!this._isServerBase()) p.set('appid', this.apiKey);
      if (!this._isServerBase()) {
        p.set('units', params.units || this.units);
        p.set('lang', params.lang || this.lang);
      }
      return `${this.baseUrl}?${p.toString()}`;
    }

    async _fetchFreeTierAggregate(params){
      const q = (base) => {
        const p = new URLSearchParams();
        p.set('lat', String(params.lat));
        p.set('lon', String(params.lon));
        p.set('appid', this.apiKey);
        p.set('units', params.units || this.units);
        p.set('lang', params.lang || this.lang);
        return `${base}?${p.toString()}`;
      };
      const curUrl = q('https://api.openweathermap.org/data/2.5/weather');
      const fcUrl = q('https://api.openweathermap.org/data/2.5/forecast');
      const [curRes, fcRes] = await Promise.all([
        this._requestJson(curUrl, { retries: 1 }),
        this._requestJson(fcUrl, { retries: 1 }),
      ]);
      const current = {
        dt: curRes.dt,
        sunrise: curRes.sys && curRes.sys.sunrise,
        sunset: curRes.sys && curRes.sys.sunset,
        temp: toNumber(curRes.main && curRes.main.temp),
        feels_like: toNumber(curRes.main && curRes.main.feels_like),
        pressure: toNumber(curRes.main && curRes.main.pressure),
        humidity: toNumber(curRes.main && curRes.main.humidity),
        dew_point: null,
        uvi: 0,
        clouds: toNumber(curRes.clouds && curRes.clouds.all),
        visibility: toNumber(curRes.visibility, null),
        wind_speed: toNumber(curRes.wind && curRes.wind.speed),
        wind_deg: toNumber(curRes.wind && curRes.wind.deg),
        wind_gust: toNumber(curRes.wind && curRes.wind.gust, null),
        rain: curRes.rain ? { '1h': toNumber(curRes.rain['1h'], 0), '3h': toNumber(curRes.rain['3h'], 0) } : undefined,
        snow: curRes.snow ? { '1h': toNumber(curRes.snow['1h'], 0), '3h': toNumber(curRes.snow['3h'], 0) } : undefined,
        weather: pickWeather(curRes.weather),
      };
      const hourly = Array.isArray(fcRes.list) ? fcRes.list.map((it) => ({
        dt: it.dt,
        temp: toNumber(it.main && it.main.temp),
        feels_like: toNumber(it.main && it.main.feels_like),
        pressure: toNumber(it.main && it.main.pressure),
        humidity: toNumber(it.main && it.main.humidity),
        dew_point: null,
        uvi: 0,
        clouds: toNumber(it.clouds && it.clouds.all),
        visibility: toNumber(it.visibility, null),
        wind_speed: toNumber(it.wind && it.wind.speed),
        wind_deg: toNumber(it.wind && it.wind.deg),
        wind_gust: toNumber(it.wind && it.wind.gust, null),
        pop: toNumber(it.pop, 0),
        rain: it.rain ? { '3h': toNumber(it.rain['3h'], 0), '1h': toNumber(it.rain['1h'], 0) } : undefined,
        snow: it.snow ? { '3h': toNumber(it.snow['3h'], 0), '1h': toNumber(it.snow['1h'], 0) } : undefined,
        weather: pickWeather(it.weather),
      })) : [];
      return {
        lat: toNumber((curRes.coord && curRes.coord.lat) || params.lat),
        lon: toNumber((curRes.coord && curRes.coord.lon) || params.lon),
        timezone: curRes.timezone || null,
        timezone_offset: toNumber(curRes.timezone, 0),
        current,
        hourly,
        daily: [],
      };
    }

    _cacheGet(kind, key) {
      const mem = this._mem.get(kind + '|' + key);
      let disk = null;
      if (!mem) {
        const raw = this._storage.getItem(this._storageKey(kind, key));
        if (raw) disk = safeJsonParse(raw);
      }
      return mem || disk || null;
    }

    _cacheSet(kind, key, entry) {
      this._mem.set(kind + '|' + key, entry);
      try {
        this._storage.setItem(this._storageKey(kind, key), JSON.stringify(entry));
      } catch (_) {}
    }

    async _revalidate(kind, key, url) {
      const memKey = kind + '|' + key;
      const existing = this._mem.get(memKey) || {};
      if (existing.refreshing) return;
      existing.refreshing = true;
      this._mem.set(memKey, existing);
      try {
        this._em.emit('revalidate_start',{key,url});
        const json = await this._requestJson(url);
        if (!this._isServerBase()) this._incrementApiCallCount();
        const norm = this._normalize(json);
        const entry = { ts: this._now(), data: norm };
        this._cacheSet(kind, key, entry);
        this._em.emit('revalidate_success',{key,ts:entry.ts});
      } catch (e) {
        this._em.emit('revalidate_error',{key,error:e});
      } finally {
        const cur = this._mem.get(memKey) || {};
        cur.refreshing = false;
        this._mem.set(memKey, cur);
      }
    }

    _normalize(json) {
      return {
        lat: json.lat,
        lon: json.lon,
        timezone: json.timezone,
        timezone_offset: json.timezone_offset,
        current: normalizeCurrent(json.current),
        hourly: normalizeHourly(json.hourly),
        daily: normalizeDaily(json.daily),
      };
    }

    _keyFor(params){ return `${params.lat.toFixed(3)},${params.lon.toFixed(3)}:${this.units}:${this.lang}:ex=minutely,alerts`; }

    async fetchOneCall(params) {
      if (!this._isServerBase() && this.isApiCallLimitReached()) {
        const e = new WeatherServiceError(`OneCall API 3 call limit reached (${this._apiCallLimit} calls)`, 'LIMIT_REACHED');
        this._em.emit('error', e);
        throw e;
      }

      const key = this._keyFor(params);
      const exclude = 'minutely,alerts';
      const url = this._composeUrl({ ...params, exclude });
      const kind = 'onecall';

      const entry = this._cacheGet(kind, key);
      const ttlCurrent = this._ttlFor('current');
      const ttlHourly = this._ttlFor('hourly');
      const ttlDaily = this._ttlFor('daily');

      const now = this._now();
      if (entry) {
        this._em.emit('cache_hit',{key,ts:entry.ts});
        const age = now - entry.ts;
        const freshForAny = age < Math.min(ttlCurrent, ttlHourly, ttlDaily);
        const result = { ...entry.data, units: this.units, lang: this.lang, _meta: { ts: entry.ts, stale: !freshForAny, source: 'cache', ttl_current_ms: ttlCurrent, ttl_hourly_ms: ttlHourly, ttl_daily_ms: ttlDaily } };
        if (!freshForAny) {
          Promise.resolve().then(() => this._revalidate(kind, key, url));
        }
        return result;
      } else {
        this._em.emit('cache_miss',{key});
      }

      try{
        let json;
        try {
          json = await this._requestJson(url);
          if (!this._isServerBase()) this._incrementApiCallCount();
        } catch (e) {
          if (e && e.code === 'UNAUTHENTICATED') {
            if (!this._isServerBase() && typeof this.baseUrl === 'string' && this.baseUrl.includes('/3.0/onecall')) {
              try {
                const fallbackUrl = url.replace('/3.0/onecall', '/2.5/onecall');
                json = await this._requestJson(fallbackUrl, { retries: 1 });
              } catch (_e) {
                json = await this._fetchFreeTierAggregate(params);
              }
            } else if (!this._isServerBase()) {
              json = await this._fetchFreeTierAggregate(params);
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }
        const norm = this._normalize(json);
        const ts = (json && json._meta && typeof json._meta.ts === 'number') ? json._meta.ts : now;
        const newEntry = { ts, data: norm };
        this._cacheSet(kind, key, newEntry);
        const meta = (json && json._meta && typeof json._meta === 'object') ? json._meta : { ts, stale: false, source: 'network' };
        return { ...norm, units: this.units, lang: this.lang, _meta: meta };
      } catch(e){
        const fallback=this._cacheGet(kind,key);
        if(fallback){
          this._em.emit('fallback_cache',{key});
          return { ...fallback.data, units:this.units, lang:this.lang, _meta:{ ts:fallback.ts, stale:true, source:'cache' } };
        }
        throw e;
      }
    }

    async getCurrent(lat, lon) {
      const data = await this.fetchOneCall({ lat, lon });
      return { ...data.current, lat: data.lat, lon: data.lon, units: this.units, _meta: data._meta };
    }

    async getHourly(lat, lon) {
      const data = await this.fetchOneCall({ lat, lon });
      return { list: data.hourly, lat: data.lat, lon: data.lon, units: this.units, _meta: data._meta };
    }

    async getDaily(lat, lon) {
      const data = await this.fetchOneCall({ lat, lon });
      return { list: data.daily, lat: data.lat, lon: data.lon, units: this.units, _meta: data._meta };
    }

    async getHourly3h(lat, lon) {
      const data = await this.fetchOneCall({ lat, lon });
      const list = resampleHourlyTo3h(data.hourly);
      return { list, lat: data.lat, lon: data.lon, units: this.units, _meta: data._meta };
    }

    getCachedOneCall(params){ const key=this._keyFor(params); const entry=this._cacheGet('onecall',key); if(!entry) return null; return { ...entry.data, units:this.units, lang:this.lang, _meta:{ ts:entry.ts, stale:true, source:'cache' } }; }
  }

  WeatherService.InMemoryStorage = InMemoryStorage;
  WeatherService.Error = WeatherServiceError;
  WeatherService._internals = {
    normalizeCurrent,
    normalizeHourly,
    normalizeDaily,
    resampleHourlyTo3h,
    aggregate3h,
  };

  return WeatherService;
});
