const http = require('http');
const cheerio = require('cheerio');
const { inc } = require('../lib/metrics');

class NagiosService {
  constructor({ baseUrl, user, pass, enable = false, refreshMs = 60000 }) {
    this.baseUrl = baseUrl;
    this.user = user;
    this.pass = pass;
    this.enable = !!enable;
    this.refreshMs = refreshMs;
    this.cache = { data: null, ts: 0 };
  }

  async getAllStatus(force = false) {
    const now = Date.now();
    if (!force && this.cache.data && (now - this.cache.ts < this.refreshMs)) return this.cache.data;
    if (!this.enable) return this.cache.data || [];
    const [services, hosts] = await Promise.all([
      this.fetchFromNagios(null, 'services').catch(() => []),
      this.fetchFromNagios(null, 'hosts').catch(() => []),
    ]);
    const all = [...services, ...hosts];
    this.cache = { data: all, ts: now };
    return all;
  }

  fetchFromNagios(hostName = null, type = 'services') {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.user}:${this.pass}`).toString('base64');
      let url;
      if (type === 'hosts') {
        url = `${this.baseUrl}/cgi-bin/status.cgi?hostgroup=all&style=hostdetail&limit=0`;
      } else {
        url = hostName ? `${this.baseUrl}/cgi-bin/status.cgi?host=${encodeURIComponent(hostName)}&limit=0` : `${this.baseUrl}/cgi-bin/status.cgi?host=all&limit=0`;
      }
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        headers: { 'Authorization': `Basic ${auth}` },
        timeout: 15000,
      };
      const req = http.get(options, (res) => {
        let html = '';
        res.on('data', (c) => html += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = type === 'hosts' ? this.parseHostHTML(html) : this.parseServicesHTML(html);
              inc('integration_calls_total', { service: 'nagios', op: type, status: 'success' });
              resolve(data);
            } catch (e) {
              inc('integration_calls_total', { service: 'nagios', op: type, status: 'error' });
              reject(new Error(`Failed to parse HTML: ${e.message}`));
            }
          } else {
            inc('integration_calls_total', { service: 'nagios', op: type, status: 'error' });
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
    });
  }

  parseHostHTML(html) {
    const $ = cheerio.load(html);
    const hosts = [];
    $('tr').each((_, row) => {
      const cells = $('td', row);
      if (cells.length < 3) return;
      const hostName = $(cells[0]).text().trim();
      const status = $(cells[1]).text().trim();
      const info = $(cells[cells.length - 1]).text().trim();
      if (hostName && status && hostName !== 'Host' && status !== 'Status' && hostName.length < 100) {
        let stateCode = 0; let stateText = 'UP';
        if (status.includes('DOWN')) { stateCode = 2; stateText = 'DOWN'; }
        else if (status.includes('UNREACHABLE')) { stateCode = 1; stateText = 'UNREACHABLE'; }
        hosts.push({
          host_name: hostName,
          service_name: 'Host Status',
          current_state: stateCode,
          current_state_text: stateText,
          plugin_output: info,
          last_check: new Date().toISOString(),
          is_host: true,
        });
      }
    });
    return hosts;
  }

  parseServicesHTML(html) {
    const $ = cheerio.load(html);
    const services = [];
    let currentHost = '';
    $('tr').each((_, row) => {
      const cells = $('td', row);
      if (cells.length < 3) return;
      let hostName = $(cells[0]).text().trim();
      const serviceName = $(cells[1]).text().trim();
      const status = $(cells[2]).text().trim();
      if (hostName) currentHost = hostName; else hostName = currentHost;
      if (hostName && serviceName && status && serviceName !== 'Service' && status !== 'Status' && hostName.length < 100) {
        if (hostName.includes('Status') || serviceName.includes('Status') || hostName.includes('History')) return;
        let stateCode = 0; let stateText = 'OK';
        if (status.includes('CRITICAL')) { stateCode = 2; stateText = 'CRITICAL'; }
        else if (status.includes('WARNING')) { stateCode = 1; stateText = 'WARNING'; }
        else if (status.includes('UNKNOWN')) { stateCode = 3; stateText = 'UNKNOWN'; }
        services.push({
          host_name: hostName,
          service_name: serviceName,
          current_state: stateCode,
          current_state_text: stateText,
          plugin_output: status,
          last_check: new Date().toISOString(),
          next_check: new Date().toISOString(),
        });
      }
    });
    return services;
  }
}

module.exports = { NagiosService };

// Toggle helpers
NagiosService.prototype.setEnabled = function (enabled) {
  this.enable = !!enabled;
};

NagiosService.prototype.isEnabled = function () {
  return !!this.enable;
};
