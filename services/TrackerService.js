const path = require('path');
const fs = require('fs');
const { fetchWithRetry } = require('../lib/http');
const { inc } = require('../lib/metrics');

class TrackerService {
  constructor({ baseUrl, user, pass, enable = false, dataDir }) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.pass = pass;
    this.enable = !!enable;
    this.dataDir = dataDir;
    this.positionsCache = { data: null, ts: 0 };
    this.devicesCache = { data: null, ts: 0 };
  }

  async ensureUserIconFolder(username) {
    const userIconDir = path.join(this.dataDir, username);
    if (!fs.existsSync(userIconDir)) fs.mkdirSync(userIconDir, { recursive: true });
  }

  async fetchPositions() {
    const now = Date.now();
    if (this.positionsCache.data && (now - this.positionsCache.ts < 5000)) {
      inc('cache_hit', { cache: 'tracker_positions' });
      return this.positionsCache.data;
    }
    if (!this.enable) return this.positionsCache.data || [];
    const auth = Buffer.from(`${this.user}:${this.pass}`).toString('base64');
    const res = await fetchWithRetry(`${this.baseUrl}/api/positions`, { headers: { Authorization: `Basic ${auth}` }, timeout: 10000, retries: 1 });
    if (!res.ok) {
      inc('integration_calls_total', { service: 'traccar', op: 'positions', status: 'error' });
      return this.positionsCache.data || [];
    }
    inc('integration_calls_total', { service: 'traccar', op: 'positions', status: 'success' });
    inc('cache_miss', { cache: 'tracker_positions' });
    const positions = await res.json();
    this.positionsCache = { data: positions, ts: now };
    for (const p of positions) {
      if (p.attributes && p.attributes.name) await this.ensureUserIconFolder(p.attributes.name);
    }
    return positions;
  }

  async fetchDevices() {
    const now = Date.now();
    if (this.devicesCache.data && (now - this.devicesCache.ts < 600000)) {
      inc('cache_hit', { cache: 'tracker_devices' });
      return this.devicesCache.data;
    }
    if (!this.enable) return this.devicesCache.data || [];
    const auth = Buffer.from(`${this.user}:${this.pass}`).toString('base64');
    const res = await fetchWithRetry(`${this.baseUrl}/api/devices`, { headers: { Authorization: `Basic ${auth}` }, timeout: 10000, retries: 1 });
    if (!res.ok) {
      inc('integration_calls_total', { service: 'traccar', op: 'devices', status: 'error' });
      return this.devicesCache.data || [];
    }
    inc('integration_calls_total', { service: 'traccar', op: 'devices', status: 'success' });
    inc('cache_miss', { cache: 'tracker_devices' });
    const devices = await res.json();
    this.devicesCache = { data: devices, ts: now };
    for (const d of devices) {
      if (d.name) await this.ensureUserIconFolder(d.name);
    }
    return devices;
  }
}

module.exports = { TrackerService };

// Toggle helpers
TrackerService.prototype.setEnabled = function (enabled) {
  this.enable = !!enabled;
};

TrackerService.prototype.isEnabled = function () {
  return !!this.enable;
};
