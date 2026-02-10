const { test, expect } = require('@playwright/test');
const path = require('path');

async function injectScript(page, src) {
  await page.addScriptTag({ path: path.resolve(__dirname, '..', src) });
}

test.describe('WeatherOverlay UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5505/map.html');
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
    expect(Math.round(boxAfter.width)).toBe(Math.round(boxMid.width));
    expect(Math.round(boxAfter.height)).toBe(Math.round(boxMid.height));
  });

  test('animations update with clock and canvas renders content', async ({ page }) => {
    await page.evaluate(() => { window.__ov = new WeatherOverlay({ id: 'anim', service: null, clock: new ClockManager({ mode: 'simulation', rate: 5 }) }).mount(document.body); });
    await page.waitForTimeout(200);
    const hasContent = await page.evaluate(() => {
      const cv = document.querySelector('.weather-overlay canvas');
      const ctx = cv.getContext('2d');
      const w = cv.width, h = cv.height;
      const data = ctx.getImageData(0, 0, Math.min(20,w), Math.min(20,h)).data;
      let acc = 0; for (let i = 0; i < data.length; i+=4) { acc += data[i] + data[i+1] + data[i+2]; }
      return acc > 0;
    });
    expect(hasContent).toBeTruthy();
  });
});
