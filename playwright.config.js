const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.PORT || 5505);
const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: BASE_URL,
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'node server.js',
    port: PORT,
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      PORT: String(PORT),
      ENABLE_TRACCAR: 'false',
      ENABLE_SPLYNX_TASKS: 'false',
      ENABLE_NAGIOS: 'false',
      ENABLE_WEATHER: 'false'
    }
  },
  globalSetup: require.resolve('./tests/global-setup.js')
});
