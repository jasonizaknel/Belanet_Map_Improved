const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Nagios Integration and Map Marker Synchronization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the map page
    await page.goto(BASE + '/map.html');
    // Wait for data to load
    await page.waitForFunction(() => window.AppState && window.AppState.dataLoaded === true, { timeout: 30000 });
  });

  test('should display host status in tower info window', async ({ page }) => {
    // Find a tower marker that we know should have Nagios data (e.g., Office)
    await page.evaluate(() => {
      const officeTower = window.AppState.towerMarkers.find(t => t.tower.id === 'Office');
      if (officeTower) {
        // Mock some status so we definitely have something to show
        window.AppState.nagiosStatus['BnetOffice-Tower.belanet.co.za'] = {
          hostName: 'BnetOffice-Tower.belanet.co.za',
          overallStatus: 'UP',
          services: []
        };
        google.maps.event.trigger(officeTower.marker, 'click');
      }
    });

    // Check if the info window appeared and contains Host Status
    const infoWindow = page.locator('.gm-style-iw-d');
    await infoWindow.waitFor({ state: 'visible', timeout: 10000 });
    await expect(infoWindow).toBeVisible();
    await expect(infoWindow).toContainText('Host Status:');
    await expect(infoWindow).toContainText('UP');
  });

  test('should update tower marker colors based on Nagios status', async ({ page }) => {
    await page.evaluate(() => {
      const mockServices = [
        {
          host_name: 'BnetOffice-Tower.belanet.co.za',
          service_name: 'Host Status',
          current_state: 2, // DOWN
          current_state_text: 'DOWN',
          plugin_output: 'CRITICAL - Host is down',
          last_check: new Date().toISOString(),
          is_host: true
        }
      ];
      window.processNagiosStatus(mockServices);
    });

    const statusColor = await page.evaluate(() => {
      return window.getTowerStatusColor('Office');
    });
    
    expect(statusColor).toBe('#d32f2f');
  });

  test('should correctly identify sectors from Nagios data', async ({ page }) => {
    await page.evaluate(() => {
      const mockServices = [
        {
          host_name: 'BnetOffice-Sec1',
          service_name: 'Host Status',
          current_state: 0,
          current_state_text: 'UP',
          plugin_output: 'OK',
          is_host: true
        }
      ];
      window.processNagiosStatus(mockServices);
    });

    const sectors = await page.evaluate(() => {
      return window.getTowerSectorStatus('Office');
    });

    expect(sectors.length).toBeGreaterThan(0);
    // The pattern is ^prefix-(Sector|Sec|Sec)\d+
    // Office site is BnetOffice-Tower.belanet.co.za, prefix extracted is BnetOffice
    expect(sectors[0].name).toBe('BnetOffice-Sec1');
  });
});
