const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}${r}`;
}

const REDACT_KEYS = [
  'authorization', 'cookie', 'x-admin-token', 'password', 'pass', 'token', 'secret', 'apikey', 'api_key', 'appId', 'app_id', 'set-cookie'
];

function redact(obj) {
  try {
    if (obj == null) return obj;
    if (typeof obj === 'string') {
      return obj.replace(/[A-Za-z0-9_\-]{16,}/g, '***');
    }
    if (Array.isArray(obj)) return obj.map(redact);
    if (typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (REDACT_KEYS.includes(k.toLowerCase())) {
          out[k] = '***';
        } else {
          out[k] = redact(v);
        }
      }
      return out;
    }
    return obj;
  } catch {
    return obj;
  }
}

function currentContext() {
  return als.getStore() || {};
}

function baseLog(level, message, extra) {
  const { requestId, subsystem } = currentContext();
  const entry = {
    ts: new Date().toISOString(),
    level,
    subsystem: subsystem || 'server',
    requestId: requestId || null,
    msg: String(message || ''),
  };
  if (extra && Object.keys(extra).length) entry.extra = redact(extra);
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

const logger = {
  info: (m, e) => baseLog('info', m, e),
  warn: (m, e) => baseLog('warn', m, e),
  error: (m, e) => baseLog('error', m, e),
  debug: (m, e) => baseLog('debug', m, e),
  child(fields = {}) {
    return {
      info: (m, e) => baseLog('info', m, { ...(fields||{}), ...(e||{}) }),
      warn: (m, e) => baseLog('warn', m, { ...(fields||{}), ...(e||{}) }),
      error: (m, e) => baseLog('error', m, { ...(fields||{}), ...(e||{}) }),
      debug: (m, e) => baseLog('debug', m, { ...(fields||{}), ...(e||{}) }),
    };
  }
};

function requestLoggerMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || genId();
  const ctx = { requestId: String(reqId), subsystem: 'http' };
  als.run(ctx, () => {
    res.setHeader('x-request-id', ctx.requestId);
    const start = Date.now();
    logger.info('request', { method: req.method, path: req.path, ip: req.ip });
    res.on('finish', () => {
      logger.info('response', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
    });
    next();
  });
}

function withContext(fields, fn) {
  const base = currentContext();
  const merged = { ...base, ...(fields||{}) };
  return (...args) => als.run(merged, () => fn(...args));
}

function installConsoleInterceptor() {
  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
  console.log = (...args) => baseLog('info', args[0], args[1]);
  console.warn = (...args) => baseLog('warn', args[0], args[1]);
  console.error = (...args) => baseLog('error', args[0], args[1]);
  return () => {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  };
}

module.exports = { logger, requestLoggerMiddleware, installConsoleInterceptor, withContext, redact };
