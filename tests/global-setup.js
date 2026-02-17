module.exports = async () => {
  const port = Number(process.env.PORT || 5505);
  const baseURL = process.env.TEST_BASE_URL || `http://localhost:${port}`;
  const deadline = Date.now() + 60000;
  let lastErr = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseURL}/ready`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ready) return;
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const msg = `Server not ready at ${baseURL}/ready within 60s` + (lastErr ? `: ${lastErr.message}` : '');
  throw new Error(msg);
};
