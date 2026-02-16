const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { inc } = require('../lib/metrics');

class WeatherBackend {
  constructor({ apiKey, coordTtlMs = 10*60*1000, cacheTtlMs = 10*60*1000, dataDir, enable = false }) {
    this.apiKey = apiKey;
    this.coordTtlMs = coordTtlMs;
    this.cacheTtlMs = cacheTtlMs;
    this.coordCache = new Map();
    this.cache = { data: null, ts: 0 };
    this.statsFile = path.join(dataDir || process.cwd(), 'Data', 'weather-api-stats.json');
    this.apiCallStats = { callsUsed: 0, callLimit: 500, startTime: Date.now(), resetTime: Date.now() };
    this.enable = !!enable;
    this._loadStats();
  }

  _loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const raw = fs.readFileSync(this.statsFile, 'utf8');
        const obj = JSON.parse(raw);
        this.apiCallStats = { ...this.apiCallStats, ...obj };
      }
    } catch {}
  }

  _saveStats() {
    try {
      const dir = path.dirname(this.statsFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.statsFile, JSON.stringify(this.apiCallStats, null, 2), 'utf8');
    } catch {}
  }

  async getWeatherData(lat = -25.0, lon = 28.0) {
    const now = Date.now();
    if (this.cache.data && (now - this.cache.ts) < this.cacheTtlMs) return this.cache.data;
    if (!this.enable) return null;
    if (!this.apiKey) return null;
    try {
      const url = 'https://api.openweathermap.org/data/3.0/onecall';
      const params = { lat, lon, exclude: 'minutely,alerts', units: 'metric', appid: this.apiKey };
      const response = await axios.get(url, { params, timeout: 10000 });
      if (response.status === 200 && response.data) {
        const data = response.data;
        this.cache = { data, ts: now };
        inc('integration_calls_total', { service: 'openweather', op: 'onecall_cache', status: 'success' });
        return data;
      }
      inc('integration_calls_total', { service: 'openweather', op: 'onecall_cache', status: 'error' });
      return this.cache.data || null;
    } catch {
      inc('integration_calls_total', { service: 'openweather', op: 'onecall_cache', status: 'error' });
      return this.cache.data || null;
    }
  }

  async oneCall(lat, lon) {
    const qlat = Math.round(lat*100)/100;
    const qlon = Math.round(lon*100)/100;
    const key = `${qlat.toFixed(2)},${qlon.toFixed(2)}`;
    const now = Date.now();
    const cached = this.coordCache.get(key);
    if (cached && (now - cached.ts) < this.coordTtlMs) return cached.data;
    if (!this.enable) throw Object.assign(new Error('Weather service disabled'), { status: 503 });
    if (!this.apiKey) throw Object.assign(new Error('Weather service not configured'), { status: 503 });
    if (this.apiCallStats.callsUsed >= this.apiCallStats.callLimit) throw Object.assign(new Error('OneCall API 3 call limit reached'), { status: 429 });
    try {
      const url = 'https://api.openweathermap.org/data/3.0/onecall';
      const params = { lat: qlat, lon: qlon, exclude: 'minutely,alerts', units: 'metric', appid: this.apiKey };
      const resp = await axios.get(url, { params, timeout: 10000 });
      const data = resp.data;
      inc('integration_calls_total', { service: 'openweather', op: 'onecall', status: 'success' });
      this.apiCallStats.callsUsed += 1;
      this.apiCallStats.startTime = this.apiCallStats.startTime || Date.now();
      this._saveStats();
      this.coordCache.set(key, { ts: now, data });
      return data;
    } catch (e) {
      inc('integration_calls_total', { service: 'openweather', op: 'onecall', status: 'error' });
      if (e.response && e.response.status) throw Object.assign(new Error('Upstream error'), { status: e.response.status });
      throw new Error('Failed to fetch onecall');
    }
  }

  weatherStats() {
    return { callsUsed: this.apiCallStats.callsUsed, limit: this.apiCallStats.callLimit, startTime: this.apiCallStats.startTime, resetTime: this.apiCallStats.resetTime };
  }

  setLimit(limit) {
    const newLimit = Math.max(1, parseInt(limit, 10) || 500);
    this.apiCallStats.callLimit = newLimit;
    this._saveStats();
    return this.weatherStats();
  }

  resetCounter() {
    this.apiCallStats.callsUsed = 0;
    this.apiCallStats.resetTime = Date.now();
    this._saveStats();
    return this.weatherStats();
  }
}

module.exports = { WeatherBackend };

// Toggle helpers
WeatherBackend.prototype.setEnabled = function (enabled) {
  this.enable = !!enabled;
};

WeatherBackend.prototype.isEnabled = function () {
  return !!this.enable;
};
