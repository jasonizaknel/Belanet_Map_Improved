const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;
const path = require('path');

async function waitForGoogleMaps(page) {
  await page.waitForFunction(() => {
    return window.google && window.google.maps && window.AppState && window.AppState.map;
  }, { timeout: 30000 });
}

async function enableWeather(page) {
  const btn = page.locator('#toggleWeatherBtn');
  await btn.waitFor({ state: 'visible' });
  const isActive = await btn.evaluate((el) => el.classList.contains('active'));
  if (!isActive) {
    await btn.click();
  }
  await expect(btn).toHaveClass(/active/);
}

async function openOverlay(page) {
  await enableWeather(page);
  await expect(page.locator('.weather-overlay')).toBeVisible();
}

async function setSingleLayer(page, key) {
  await page.evaluate((k) => {
    const ov = window.__WeatherOverlay;
    if (!ov) return;
    const m = { temperature:'temp_new', precipitation:'precipitation_new', wind:'wind_new', clouds:'clouds_new' };
    const toggles = Array.from(document.querySelectorAll('.weather-overlay .weather-toggle input'));
    toggles.forEach((cb, idx) => { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); });
    const indexMap = { temperature:0, precipitation:1, wind:2, humidity:3, clouds:4 };
    const idx = indexMap[k];
    if (idx != null && toggles[idx]) { toggles[idx].checked = true; toggles[idx].dispatchEvent(new Event('change', { bubbles: true })); }
  }, key);
}

async function expectOnlyTile(page, key) {
  const allKeys = ['clouds_new','precipitation_new','rain_new','snow_new','temp_new','wind_new','pressure_new'];
  await page.waitForFunction((k) => {
    const sel = `img[src*="tile.openweathermap.org/map/${k}"]`;
    return document.querySelector(sel) != null;
  }, key, { timeout: 20000 });
  for (const other of allKeys.filter((x) => x !== key)) {
    await expect(page.locator(`img[src*="tile.openweathermap.org/map/${other}"]`)).toHaveCount(0, { timeout: 5000 }).catch(() => {});
  }
}

const layerCases = [
  { overlayKey: 'temperature', tileKey: 'temp_new' },
  { overlayKey: 'precipitation', tileKey: 'precipitation_new' },
  { overlayKey: 'wind', tileKey: 'wind_new' },
  { overlayKey: 'clouds', tileKey: 'clouds_new' },
];

for (const c of layerCases) {
  test(`screenshot: ${c.overlayKey}`, async ({ page }) => {
    await page.goto(BASE + '/map.html');
    await waitForGoogleMaps(page);
    await openOverlay(page);
    await setSingleLayer(page, c.overlayKey);
    await expectOnlyTile(page, c.tileKey);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, `../test-results/layer-${c.overlayKey}.png`), fullPage: false });
  });
}
