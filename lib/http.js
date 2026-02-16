const { setTimeout: sleep } = require('timers/promises');

async function fetchWithRetry(url, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 10000,
    retries = 2,
    backoffMs = 300,
  } = opts;

  let attempt = 0;
  for (;;) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      clearTimeout(to);
      return res;
    } catch (e) {
      if (attempt >= retries) throw e;
      const delay = backoffMs * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }
}

module.exports = { fetchWithRetry };
