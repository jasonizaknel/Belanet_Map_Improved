require('dotenv').config();

function bool(val, def = false) {
  if (val == null) return !!def;
  const s = String(val).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return !!def;
}

function nonEmpty(str) {
  if (str == null) return undefined;
  const s = String(str).trim();
  return s.length ? s : undefined;
}

function buildConfig(env = process.env) {
  const cfg = {
    PORT: parseInt(env.PORT, 10) || 5505,

    HTTP_TIMEOUT_MS: parseInt(env.HTTP_TIMEOUT_MS, 10) || 10000,
    HTTP_MAX_RETRIES: Number.isFinite(parseInt(env.HTTP_MAX_RETRIES, 10)) ? parseInt(env.HTTP_MAX_RETRIES, 10) : 2,
    HTTP_BACKOFF_BASE_MS: parseInt(env.HTTP_BACKOFF_BASE_MS, 10) || 300,

    ENABLE_TRACCAR: bool(env.ENABLE_TRACCAR, false),
    TRACCAR_URL: nonEmpty(env.TRACCAR_URL) || 'https://demo.traccar.org',
    TRACCAR_USER: nonEmpty(env.TRACCAR_USER),
    TRACCAR_PASS: nonEmpty(env.TRACCAR_PASS),

    ENABLE_SPLYNX_TASKS: bool(env.ENABLE_SPLYNX_TASKS, false),
    SPLYNX_URL: nonEmpty(env.SPLYNX_URL) || 'https://splynx.example.com',
    SPLYNX_READ_ONLY_KEY: nonEmpty(env.SPLYNX_READ_ONLY_KEY) || nonEmpty(env.SPLYNX_KEY),
    SPLYNX_ASSIGN_KEY: nonEmpty(env.SPLYNX_ASSIGN_KEY) || nonEmpty(env.SPLYNX_KEY),
    SPLYNX_SECRET: nonEmpty(env.SPLYNX_SECRET),
    SPLYNX_ADMIN_USER: nonEmpty(env.SPLYNX_ADMIN_USER),
    SPLYNX_ADMIN_PASS: nonEmpty(env.SPLYNX_ADMIN_PASS),

    ENABLE_NAGIOS: bool(env.ENABLE_NAGIOS, false),
    NAGIOS_URL: nonEmpty(env.NAGIOS_URL) || 'http://nagios.example.com/nagios',
    NAGIOS_USER: nonEmpty(env.NAGIOS_USER),
    NAGIOS_PASS: nonEmpty(env.NAGIOS_PASS),

    ENABLE_WEATHER: bool(env.ENABLE_WEATHER, false),
    OPENWEATHER_API_KEY: nonEmpty(env.OPENWEATHER_API_KEY),

    GOOGLE_MAPS_KEY: nonEmpty(env.GOOGLE_MAPS_KEY),
    ADMIN_TOKEN: nonEmpty(env.ADMIN_TOKEN),
  };

  const problems = [];

  if (cfg.ENABLE_TRACCAR) {
    if (!cfg.TRACCAR_USER) problems.push('TRACCAR_USER missing');
    if (!cfg.TRACCAR_PASS) problems.push('TRACCAR_PASS missing');
  }

  if (cfg.ENABLE_SPLYNX_TASKS) {
    if (!cfg.SPLYNX_READ_ONLY_KEY) problems.push('SPLYNX_READ_ONLY_KEY missing');
    if (!cfg.SPLYNX_SECRET) problems.push('SPLYNX_SECRET missing');
    if (!cfg.SPLYNX_ASSIGN_KEY) problems.push('SPLYNX_ASSIGN_KEY missing');
    if (!cfg.SPLYNX_ADMIN_USER) problems.push('SPLYNX_ADMIN_USER missing');
    if (!cfg.SPLYNX_ADMIN_PASS) problems.push('SPLYNX_ADMIN_PASS missing');
  }

  if (cfg.ENABLE_NAGIOS) {
    if (!cfg.NAGIOS_USER) problems.push('NAGIOS_USER missing');
    if (!cfg.NAGIOS_PASS) problems.push('NAGIOS_PASS missing');
  }

  if (cfg.ENABLE_WEATHER) {
    if (!cfg.OPENWEATHER_API_KEY) problems.push('OPENWEATHER_API_KEY missing');
  }

  const nonFatalWarnings = [];
  if (!cfg.ADMIN_TOKEN) nonFatalWarnings.push('ADMIN_TOKEN not set (admin-only routes will be disabled)');

  return {
    ...cfg,
    readiness() {
      const details = {
        process: true,
        env: {
          TRACCAR_URL: !!cfg.TRACCAR_URL,
          TRACCAR_USER: !!cfg.TRACCAR_USER,
          TRACCAR_PASS: !!cfg.TRACCAR_PASS,
          SPLYNX_URL: !!cfg.SPLYNX_URL,
          SPLYNX_KEYS: !!(cfg.SPLYNX_READ_ONLY_KEY && cfg.SPLYNX_SECRET),
          SPLYNX_ADMIN: !!(cfg.SPLYNX_ADMIN_USER && cfg.SPLYNX_ADMIN_PASS),
          NAGIOS_URL: !!cfg.NAGIOS_URL,
          NAGIOS_USER: !!cfg.NAGIOS_USER,
          NAGIOS_PASS: !!cfg.NAGIOS_PASS,
          OPENWEATHER_API_KEY: !!cfg.OPENWEATHER_API_KEY,
          ADMIN_TOKEN: !!cfg.ADMIN_TOKEN,
        },
        features: {
          traccar_enabled: cfg.ENABLE_TRACCAR,
          splynx_tasks_enabled: cfg.ENABLE_SPLYNX_TASKS,
          nagios_enabled: cfg.ENABLE_NAGIOS,
          weather_enabled: cfg.ENABLE_WEATHER,
        },
        missing: problems,
        warnings: nonFatalWarnings,
      };
      const ok = problems.length === 0;
      return { ready: ok, details };
    },
  };
}

const config = buildConfig();

module.exports = { config, buildConfig, bool, nonEmpty };
