const { test, expect } = require('@playwright/test');

test('debug overlay mount', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  await page.goto('http://localhost:5505/map.html');
  await page.waitForFunction(() => window.google && window.google.maps && window.AppState && window.AppState.map);
  console.log('Before click typeof WeatherOverlay:', await page.evaluate(() => typeof WeatherOverlay));
  console.log('Before click AppState.visibility.weather:', await page.evaluate(() => JSON.stringify(window.AppState && window.AppState.visibility)));
  await page.click('#toggleWeatherBtn');
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => ({
    hasOverlay: !!document.querySelector('.weather-overlay'),
    hasGlobal: typeof window.__WeatherOverlay !== 'undefined',
    appStateWeather: window.AppState && window.AppState.visibility && window.AppState.visibility.weather,
    appConfig: window.AppConfig,
  }));
  console.log('After click info:', info);
  await expect(page.locator('.weather-overlay')).toBeVisible({ timeout: 5000 });
});
