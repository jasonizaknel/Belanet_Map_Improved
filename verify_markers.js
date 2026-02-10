const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('Marker')) {
          console.log('PAGE LOG:', msg.text());
      }
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('Navigating to map.html...');
    await page.goto('http://localhost:5505/map.html', { waitUntil: 'networkidle' });
    
    // Wait for data to load
    console.log('Waiting for markers to initialize...');
    await page.waitForFunction(() => window.AppState && window.AppState.markersInitialized === true, { timeout: 30000 });
    
    const markerCount = await page.evaluate(() => {
        return window.AppState.customerMarkers.length;
    });
    console.log(`Total Customer Markers in AppState: ${markerCount}`);

    const visibleMarkerCount = await page.evaluate(() => {
        return window.AppState.customerMarkers.filter(m => m.marker.getMap() !== null).length;
    });
    console.log(`Visible Customer Markers (map !== null): ${visibleMarkerCount}`);

    const visibilitySettings = await page.evaluate(() => {
        return window.AppState.visibility;
    });
    console.log('Visibility Settings:', JSON.stringify(visibilitySettings));

    await page.screenshot({ path: 'marker_check.png' });
    console.log('Screenshot saved as marker_check.png');

  } catch (err) {
    console.error('Error during browser check:', err);
  } finally {
    await browser.close();
  }
})();
