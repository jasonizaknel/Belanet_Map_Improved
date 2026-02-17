const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;
const path = require('path');

async function injectScript(page, src) {
  await page.addScriptTag({ path: path.resolve(__dirname, '..', src) });
}

test.describe('WeatherOverlay UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/map.html');
    await page.waitForSelector('#map', { timeout: 30000 });
    await injectScript(page, 'src/weather/ClockManager.js');
    await injectScript(page, 'src/weather/WeatherService.js');
    await injectScript(page, 'src/weather/WeatherOverlay.js');
  });

  test('mounts and unmounts cleanly', async ({ page }) => {
    await page.evaluate(() => {
      window.__ov = new WeatherOverlay({ id: 't1', service: null, clock: new ClockManager() }).mount(document.body);
    });
    await expect(page.locator('.weather-overlay')).toBeVisible();
    await page.evaluate(() => { window.__ov.destroy(); });
    await expect(page.locator('.weather-overlay')).toHaveCount(0);
  });

  test('layer toggles and state persistence', async ({ page }) => {
    await page.evaluate(() => { localStorage.clear(); });
    await page.evaluate(() => {
      window.__ov = new WeatherOverlay({ id: 'persist', service: null, clock: new ClockManager() }).mount(document.body);
    });
    const firstToggle = page.locator('.weather-overlay .weather-toggle input').first();
    const checkedBefore = await firstToggle.isChecked();
    await firstToggle.click();
    const checkedAfter = await firstToggle.isChecked();
    expect(checkedAfter).toBe(!checkedBefore);

    await page.reload();
    await injectScript(page, 'src/weather/ClockManager.js');
    await injectScript(page, 'src/weather/WeatherService.js');
    await injectScript(page, 'src/weather/WeatherOverlay.js');
    await page.evaluate(() => {
      window.__ov = new WeatherOverlay({ id: 'persist', service: null, clock: new ClockManager() }).mount(document.body);
    });
    const firstToggle2 = page.locator('.weather-overlay .weather-toggle input').first();
    await expect(firstToggle2).toHaveJSProperty('checked', checkedAfter);
  });

  test('drag, resize, and persist position/size', async ({ page }) => {
    await page.evaluate(() => { localStorage.clear(); });
    await page.evaluate(() => { window.__ov = new WeatherOverlay({ id: 'geom', service: null, clock: new ClockManager() }).mount(document.body); });

    const header = page.locator('.weather-overlay__header');
    const boxBefore = await page.locator('.weather-overlay').boundingBox();

    await header.hover();
    await page.mouse.down();
    await page.mouse.move((boxBefore.x || 0) + 50, (boxBefore.y || 0) + 40);
    await page.mouse.up();

    const handle = page.locator('.weather-overlay__resize');
    const hb = await handle.boundingBox();
    await page.mouse.move((hb.x || 0) + 2, (hb.y || 0) + 2);
    await page.mouse.down();
    await page.mouse.move((hb.x || 0) + 40, (hb.y || 0) + 35);
    await page.mouse.up();

    const boxMid = await page.locator('.weather-overlay').boundingBox();
    expect(boxMid.x).not.toBe(boxBefore.x);
    expect(boxMid.y).not.toBe(boxBefore.y);
    expect(boxMid.width).toBeGreaterThan(boxBefore.width);
    expect(boxMid.height).toBeGreaterThan(boxBefore.height);

    await page.reload();
    await injectScript(page, 'src/weather/ClockManager.js');
    await injectScript(page, 'src/weather/WeatherService.js');
    await injectScript(page, 'src/weather/WeatherOverlay.js');
    await page.evaluate(() => { window.__ov = new WeatherOverlay({ id: 'geom', service: null, clock: new ClockManager() }).mount(document.body); });
    const boxAfter = await page.locator('.weather-overlay').boundingBox();
    expect(Math.round(boxAfter.x)).toBe(Math.round(boxMid.x));
    expect(Math.round(boxAfter.y)).toBe(Math.round(boxMid.y));
    const dw = Math.abs(Math.round(boxAfter.width) - Math.round(boxMid.width));
    const dh = Math.abs(Math.round(boxAfter.height) - Math.round(boxMid.height));
    expect(dw).toBeLessThanOrEqual(2);
    expect(dh).toBeLessThanOrEqual(2);
  });

  test('legends render for active layers and hover content updates', async ({ page }) => {
    await page.evaluate(() => { localStorage.clear(); });
    await page.evaluate(() => { window.__ov = new WeatherOverlay({ id: 'animless', service: null, clock: new ClockManager() }).mount(document.body); });
    // Enable temperature and wind
    const toggles = page.locator('.weather-overlay .weather-toggle input');
    await toggles.nth(0).check();
    await toggles.nth(2).check();
    await page.waitForTimeout(150);
    // Expect at least two legend boxes
    await expect(page.locator('.weather-overlay .wo-legends > div')).toHaveCount(2);
    // Update hover content via API
    await page.evaluate(() => { if (window.__ov && typeof window.__ov.setHoverContent === 'function') window.__ov.setHoverContent('hover: 1,1 · 24°C · 3.2 m/s · 0 mm'); });
    await expect(page.locator('.weather-overlay .wo-hover')).toContainText('24°C');
  });

  test('capture Weather Overlay UI screenshot', async ({ page }) => {
    await page.evaluate(() => { window.__ov = new WeatherOverlay({ id: 'shot', service: null, clock: new ClockManager() }).mount(document.body); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/weather-overlay-ui.png'), fullPage: true });
  });
});
