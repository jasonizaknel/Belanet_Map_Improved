const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { fetchWithRetry } = require('../lib/http');
const { inc, setGauge } = require('../lib/metrics');
const { LruTtlCache } = require('../lib/cache');

class WeatherBackend {
  constructor({ apiKey, coordTtlMs = 10*60*1000, cacheTtlMs = 10*60*1000, dataDir, enable = false }) {
    this.apiKey = apiKey;
    this.coordTtlMs = coordTtlMs;
    this.cacheTtlMs = cacheTtlMs;
    this.globalCache = new LruTtlCache({ name: 'weather_global', ttlMs: this.cacheTtlMs, maxSize: 8 });
    this.coordCache = new LruTtlCache({ name: 'weather_coord', ttlMs: this.coordTtlMs, maxSize: 512 });
    this.statsFile = path.join(dataDir || process.cwd(), 'Data', 'weather-api-stats.json');
    this.apiCallStats = { callsUsed: 0, callLimit: 500, startTime: Date.now(), resetTime: Date.now() };
    this.enable = !!enable;
    this._loadStatsAsync().catch(() => {});
    try { console.warn('[Weather] Client cache is advisory; server cache is authoritative for now'); } catch(_) {}
    try { setGauge('weather_server_ttl_ms', { type: 'global' }, this.cacheTtlMs); setGauge('weather_server_ttl_ms', { type: 'coord' }, this.coordTtlMs); } catch(_) {}
    try { const { logger } = require('../lib/logger'); if (logger && typeof logger.info==='function') { logger.info('weather.ttl_config', { cacheTtlMs: this.cacheTtlMs, coordTtlMs: this.coordTtlMs }); } else { console.info('[Weather] TTLs', { cacheTtlMs: this.cacheTtlMs, coordTtlMs: this.coordTtlMs }); } } catch(_) {}
  }

  async _loadStatsAsync() {
    try {
      await fsp.access(this.statsFile).catch(() => null);
      const raw = await fsp.readFile(this.statsFile, 'utf8');
      const obj = JSON.parse(raw);
      this.apiCallStats = { ...this.apiCallStats, ...obj };
    } catch {}
  }

  async _saveStatsAsync() {
    try {
      const dir = path.dirname(this.statsFile);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(this.statsFile, JSON.stringify(this.apiCallStats, null, 2), 'utf8');
    } catch {}
  }

  _meta({ source, ts, ttlMs, key }) {
    return { ts, stale: false, source, ttl_ms: ttlMs, key: key || null };
  }

  async getWeatherData(lat = -25.0, lon = 28.0) {
    const now = Date.now();
    try { inc('weather_fetch_total', { source: 'server', route: '/api/weather' }); } catch(_) {}
    const k = 'global';
    const fromCache = this.globalCache.get(k);
    if (fromCache) return { ...fromCache, _meta: this._meta({ source: 'cache', ts: this.globalCache.ts(k), ttlMs: this.cacheTtlMs, key: k }) };
    if (!this.enable) return null;
    if (!this.apiKey) return null;
    try {
      const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
      const params = { lat, lon, exclude: 'minutely,alerts', units: 'metric', appid: this.apiKey };
      url.search = new URLSearchParams(params).toString();
      const response = await fetchWithRetry(url.toString(), { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        this.globalCache.set(k, data, { ttlMs: this.cacheTtlMs });
        inc('integration_calls_total', { service: 'openweather', op: 'onecall_cache', status: 'success' });
        this.apiCallStats.callsUsed += 1;
        this.apiCallStats.startTime = this.apiCallStats.startTime || now;
        await this._saveStatsAsync();
        return { ...data, _meta: this._meta({ source: 'network', ts: now, ttlMs: this.cacheTtlMs, key: k }) };
      }
      inc('integration_calls_total', { service: 'openweather', op: 'onecall_cache', status: 'error' });
      return null;
    } catch {
      inc('integration_calls_total', { service: 'openweather', op: 'onecall_cache', status: 'error' });
      return null;
    }
  }

  async oneCall(lat, lon) {
    const qlat = Math.round(lat*100)/100;
    const qlon = Math.round(lon*100)/100;
    const key = `${qlat.toFixed(2)},${qlon.toFixed(2)}`;
    const now = Date.now();
    try { inc('weather_fetch_total', { source: 'server', route: '/api/onecall' }); } catch(_) {}
    const cached = this.coordCache.get(key);
    if (cached) return { ...cached, _meta: this._meta({ source: 'cache', ts: this.coordCache.ts(key), ttlMs: this.coordTtlMs, key }) };
    if (!this.enable) throw Object.assign(new Error('Weather service disabled'), { status: 503 });
    if (!this.apiKey) throw Object.assign(new Error('Weather service not configured'), { status: 503 });
    if (this.apiCallStats.callsUsed >= this.apiCallStats.callLimit) throw Object.assign(new Error('OneCall API 3 call limit reached'), { status: 429 });
    try {
      const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
      const params = { lat: qlat, lon: qlon, exclude: 'minutely,alerts', units: 'metric', appid: this.apiKey };
      url.search = new URLSearchParams(params).toString();
      const resp = await fetchWithRetry(url.toString(), { headers: { Accept: 'application/json' } });
      if (!resp.ok) {
        inc('integration_calls_total', { service: 'openweather', op: 'onecall', status: 'error' });
        throw Object.assign(new Error('Upstream error'), { status: resp.status });
      }
      const data = await resp.json();
      inc('integration_calls_total', { service: 'openweather', op: 'onecall', status: 'success' });
      this.apiCallStats.callsUsed += 1;
      this.apiCallStats.startTime = this.apiCallStats.startTime || now;
      await this._saveStatsAsync();
      this.coordCache.set(key, data, { ttlMs: this.coordTtlMs });
      return { ...data, _meta: this._meta({ source: 'network', ts: now, ttlMs: this.coordTtlMs, key }) };
    } catch (e) {
      inc('integration_calls_total', { service: 'openweather', op: 'onecall', status: 'error' });
      if (e && typeof e === 'object' && e.status) throw Object.assign(new Error('Upstream error'), { status: e.status });
      throw new Error('Failed to fetch onecall');
    }
  }

  weatherStats() {
    return { callsUsed: this.apiCallStats.callsUsed, limit: this.apiCallStats.callLimit, startTime: this.apiCallStats.startTime, resetTime: this.apiCallStats.resetTime };
  }

  async setLimit(limit) {
    const newLimit = Math.max(1, parseInt(limit, 10) || 500);
    this.apiCallStats.callLimit = newLimit;
    await this._saveStatsAsync();
    return this.weatherStats();
  }

  async resetCounter() {
    this.apiCallStats.callsUsed = 0;
    this.apiCallStats.resetTime = Date.now();
    await this._saveStatsAsync();
    return this.weatherStats();
  }
}

module.exports = { WeatherBackend };

WeatherBackend.prototype.setEnabled = function (enabled) {
  this.enable = !!enabled;
};

WeatherBackend.prototype.isEnabled = function () {
  return !!this.enable;
};
