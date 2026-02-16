const counters = new Map();
const gauges = new Map();

function key(name, labels) {
  if (!labels || !Object.keys(labels).length) return name;
  const parts = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`);
  return `${name}|${parts.join(',')}`;
}

function inc(name, labels = {}, by = 1) {
  const k = key(name, labels);
  const v = counters.get(k) || 0;
  counters.set(k, v + by);
}

function setGauge(name, labels = {}, value) {
  const k = key(name, labels);
  gauges.set(k, Number(value) || 0);
}

function snapshot() {
  const out = { counters: {}, gauges: {} };
  for (const [k, v] of counters.entries()) out.counters[k] = v;
  for (const [k, v] of gauges.entries()) out.gauges[k] = v;
  return out;
}

function requestMetricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path || 'unknown';
    inc('http_requests_total', { method: req.method, route, status: res.statusCode });
    const ms = Date.now() - start;
    inc('http_request_ms_sum', { route });
    inc('http_request_ms_count', { route });
    setGauge('http_request_last_ms', { route }, ms);
  });
  next();
}

module.exports = {
  inc,
  setGauge,
  snapshot,
  requestMetricsMiddleware,
};
