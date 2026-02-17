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

async function expectTile(page, key) {
  await page.waitForFunction((k) => {
    const q = `img[src*="tile.openweathermap.org/map/${k}"]`;
    return document.querySelector(q) != null;
  }, key, { timeout: 30000 });
}

test.describe('Weather Overlay E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/map.html');
    await waitForGoogleMaps(page);
  });

  test('toggle via sidebar button shows/hides overlay and syncs state', async ({ page }) => {
    const btn = page.locator('#toggleWeatherBtn');
    await btn.waitFor({ state: 'visible' });
    const wasActive = await btn.evaluate((el) => el.classList.contains('active'));
    await btn.click();
    await expect(btn).toHaveClass(wasActive ? /^(?!.*active).*/ : /active/);
    await btn.click();
    await expect(btn).toHaveClass(wasActive ? /active/ : /^(?!.*active).*/);
  });

  test('overlay mounts, resizes, and persists geometry', async ({ page, context }) => {
    const btn = page.locator('#toggleWeatherBtn');
    await enableWeather(page);
    const root = page.locator('.weather-overlay');
    await expect(root).toBeVisible();

    const boxBefore = await root.boundingBox();
    const handle = page.locator('.weather-overlay__resize');
    const hb = await handle.boundingBox();
    await page.mouse.move((hb.x || 0) + 2, (hb.y || 0) + 2);
    await page.mouse.down();
    await page.mouse.move((hb.x || 0) + 80, (hb.y || 0) + 60);
    await page.mouse.up();
    const boxAfter = await root.boundingBox();
    expect(boxAfter.width).toBeGreaterThan(boxBefore.width);
    expect(boxAfter.height).toBeGreaterThan(boxBefore.height);

    await page.reload();
    await waitForGoogleMaps(page);
    await enableWeather(page);
    const boxReloaded = await page.locator('.weather-overlay').boundingBox();
    expect(Math.round(boxReloaded.width)).toBeGreaterThanOrEqual(Math.round(boxAfter.width) - 2);
    expect(Math.round(boxReloaded.height)).toBeGreaterThanOrEqual(Math.round(boxAfter.height) - 2);
  });

  test('temperature and precipitation tiles load, with optional rain and snow', async ({ page }) => {
    await enableWeather(page);
    await expectTile(page, 'temp_new');
    await expectTile(page, 'precipitation_new');

    const added = await page.evaluate(() => {
      if (!window.AppState || !AppState.map || !AppState.weatherLayers) return false;
      const arr = ['rain_new', 'snow_new'];
      let pushed = 0;
      arr.forEach((k) => {
        const t = AppState.weatherLayers[k];
        if (t) {
          AppState.map.overlayMapTypes.push(t);
          pushed++;
        }
      });
      return pushed;
    });

    if (added > 0) {
      if (added >= 1) await expectTile(page, 'rain_new').catch(() => {});
      if (added >= 2) await expectTile(page, 'snow_new').catch(() => {});
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/weather-tiles.png'), fullPage: false });
  });
});
