const cheerio = require('cheerio');
const { chromium } = require('playwright');
const axios = require('axios');
const { fetchWithRetry } = require('../lib/http');
const { inc, setGauge } = require('../lib/metrics');
const { logger } = require('../lib/logger');

class SplynxService {
  constructor({ baseUrl, readKey, assignKey, secret, adminUser, adminPass, enable = false }) {
    this.baseUrl = baseUrl;
    this.readKey = readKey;
    this.assignKey = assignKey;
    this.secret = secret;
    this.adminUser = adminUser;
    this.adminPass = adminPass;
    this.enable = !!enable;
    this.adminsCache = { data: null, ts: 0 };
    this.tasksCache = { data: null, ts: 0 };
    this.session = { cookie: null, lastLogin: 0 };
    this._log = logger.child({ subsystem: 'splynx' });
    this._fails = 0;
    this._circuitUntil = 0;
    this._maxFails = 3;
    this._cooldownMs = 10 * 60 * 1000;
  }

  _isCircuitOpen() {
    return Date.now() < this._circuitUntil;
  }

  _recordFailure(reason) {
    this._fails += 1;
    if (this._fails >= this._maxFails) {
      this._circuitUntil = Date.now() + this._cooldownMs;
      setGauge('splynx_circuit_open', {}, 1);
      this._log.warn('circuit.open', { fails: this._fails, cooldown_ms: this._cooldownMs, reason });
    }
  }

  _recordSuccess() {
    this._fails = 0;
    this._circuitUntil = 0;
    setGauge('splynx_circuit_open', {}, 0);
  }

  async fetchAdministrators() {
    const now = Date.now();
    if (!this.enable) return this.adminsCache.data || [
      { id: 1, name: 'Admin 1 (Disabled)' },
      { id: 2, name: 'Admin 2 (Disabled)' },
      { id: 3, name: 'Technician A (Disabled)' }
    ];
    if (this.adminsCache.data && (now - this.adminsCache.ts < 3600000)) {
      inc('cache_hit', { cache: 'splynx_admins' });
      return this.adminsCache.data;
    }
    const auth = Buffer.from(`${this.readKey}:${this.secret}`).toString('base64');
    const url = `${this.baseUrl}/api/2.0/admin/administration/administrators`;
    const res = await fetchWithRetry(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 15000, retries: 1 });
    if (!res.ok) {
      inc('integration_calls_total', { service: 'splynx', op: 'administrators', status: 'error' });
      return this.adminsCache.data || [
        { id: 1, name: 'Admin 1 (Mock-Error)' },
        { id: 2, name: 'Admin 2 (Mock-Error)' },
        { id: 3, name: 'Technician A (Mock-Error)' }
      ];
    }
    inc('integration_calls_total', { service: 'splynx', op: 'administrators', status: 'success' });
    inc('cache_miss', { cache: 'splynx_admins' });
    const data = await res.json();
    this.adminsCache = { data, ts: now };
    return data;
  }

  async fetchTasksByIds(ids) {
    if (!this.enable) return [];
    const auth = Buffer.from(`${this.readKey}:${this.secret}`).toString('base64');
    const tasks = [];
    const CONCURRENCY = 5;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(async (id) => {
        const url = `${this.baseUrl}/api/2.0/admin/scheduling/tasks/${id}`;
        const res = await fetchWithRetry(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }, timeout: 5000, retries: 1 }).catch(() => null);
        if (res && res.ok) {
          const task = await res.json();
          task.Title = task.title || task.subject || 'No Title';
          task.Description = task.Description || task.description || '';
          return task;
        }
        return null;
      }));
      results.filter(Boolean).forEach(t => tasks.push(t));
    }
    return tasks;
  }

  async getSessionCookie() {
    const now = Date.now();
    if (!this.enable) return null;
    if (this.session.cookie && (now - this.session.lastLogin < 1800000)) return this.session.cookie;
    if (this._isCircuitOpen()) {
      inc('integration_calls_total', { service: 'splynx', op: 'login', status: 'circuit_open' });
      this._log.warn('login.blocked_circuit');
      return null;
    }
    setGauge('splynx_circuit_open', {}, 0);
    const log = this._log;
    const overallTimeoutMs = 90000;
    let browser;
    const loginFlow = async () => {
      try {
        log.info('login.start', { url: `${this.baseUrl}/admin/login/` });
        browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const context = await browser.newContext();
        const page = await context.newPage();
        const loginUrl = `${this.baseUrl}/admin/login/`;
        await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 60000 });
        if (!page.url().includes('/admin/dashboard')) {
          await page.waitForSelector('input[name="LoginForm[login]"]', { timeout: 10000 });
          await page.fill('input[name="LoginForm[login]"]', this.adminUser);
          await page.fill('input[name="LoginForm[password]"]', this.adminPass);
          log.info('login.submit');
          await page.click('#submit');
          await page.waitForURL('**/admin/dashboard', { timeout: 30000 });
        }
        const cookies = await context.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        if (!cookieStr) {
          inc('integration_calls_total', { service: 'splynx', op: 'login', status: 'no_cookie' });
          this._recordFailure('no_cookie');
          log.warn('login.no_cookie');
          return null;
        }
        this.session.cookie = cookieStr;
        this.session.lastLogin = Date.now();
        this._recordSuccess();
        inc('integration_calls_total', { service: 'splynx', op: 'login', status: 'success' });
        log.info('login.success');
        return cookieStr;
      } catch (e) {
        this._recordFailure(e && e.message ? e.message : 'error');
        inc('integration_calls_total', { service: 'splynx', op: 'login', status: 'error' });
        log.error('login.error', { error: e && e.message });
        return null;
      } finally {
        if (browser) try { await browser.close(); } catch {}
      }
    };

    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), overallTimeoutMs));
    const result = await Promise.race([loginFlow(), timeoutPromise]);
    if (result === 'timeout') {
      this._recordFailure('overall_timeout');
      inc('integration_calls_total', { service: 'splynx', op: 'login', status: 'timeout' });
      this._log.error('login.timeout', { ms: overallTimeoutMs });
      if (browser) try { await browser.close(); } catch {}
      return null;
    }
    return result;
  }

  async addAssignmentComment(taskId, technicianName) {
    const log = this._log.child({ op: 'comment', taskId });
    const cookieStr = await this.getSessionCookie();
    if (!cookieStr) {
      inc('integration_calls_total', { service: 'splynx', op: 'comment', status: 'no_session' });
      log.warn('comment.no_session');
      return false;
    }
    try {
      const taskUrl = `${this.baseUrl}/admin/scheduling/tasks/view?id=${taskId}`;
      log.info('view.start');
      const viewRes = await axios.get(taskUrl, { headers: { 'Cookie': cookieStr }, timeout: 10000 });
      inc('integration_calls_total', { service: 'splynx', op: 'view', status: 'success' });
      const $ = cheerio.load(viewRes.data);
      const csrfToken = $('meta[name="csrf-token"]').attr('content');
      if (!csrfToken) {
        inc('integration_calls_total', { service: 'splynx', op: 'csrf', status: 'missing' });
        log.warn('csrf.missing');
        return false;
      }
      const commentUrl = `${this.baseUrl}/admin/scheduling/tasks/view--save-comment?id=${taskId}`;
      const formData = new URLSearchParams();
      formData.append('_csrf_token', csrfToken);
      formData.append('TaskComment[text]', `This task has been assigned to ${technicianName} - Auto`);
      log.info('comment.submit');
      const saveRes = await axios.post(commentUrl, formData.toString(), { headers: { 'Cookie': cookieStr, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, timeout: 10000 });
      const ok = !!saveRes.data;
      inc('integration_calls_total', { service: 'splynx', op: 'comment', status: ok ? 'success' : 'empty' });
      if (!ok) log.warn('comment.empty_response');
      else log.info('comment.success');
      return ok;
    } catch (e) {
      inc('integration_calls_total', { service: 'splynx', op: 'comment', status: 'error' });
      this._log.error('comment.error', { taskId, error: e && e.message });
      return false;
    }
  }

  async assignTask(taskId, technicianId, technicianName) {
    if (!this.enable) return { taskId, assigned: false, commented: false };
    const auth = Buffer.from(`${this.assignKey}:${this.secret}`).toString('base64');
    const assignUrl = `${this.baseUrl}/api/2.0/admin/scheduling/tasks/${taskId}`;
    const res = await fetchWithRetry(assignUrl, { method: 'PUT', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ assignee: parseInt(technicianId) }) }).catch(() => null);
    const assigned = !!(res && res.ok);
    inc('integration_calls_total', { service: 'splynx', op: 'assign', status: assigned ? 'success' : 'error' });
    const commented = await this.addAssignmentComment(taskId, technicianName);
    return { taskId, assigned, commented };
  }
}

module.exports = { SplynxService };

SplynxService.prototype.setEnabled = function (enabled) {
  this.enable = !!enabled;
};

SplynxService.prototype.isEnabled = function () {
  return !!this.enable;
};
