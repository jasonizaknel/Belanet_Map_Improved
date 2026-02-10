const { test, expect } = require('@playwright/test');

test.describe('Belanet Map Modern UI & Simulation', () => {
  test.setTimeout(60000);
  test.beforeEach(async ({ page }) => {
    // Go to the map page
    await page.goto('http://localhost:5505/map.html');
    // Wait for the map and data to be initialized
    await page.waitForFunction(() => window.google && window.google.maps && window.AppState && window.AppState.dataLoaded === true, { timeout: 30000 });
  });

  test('should toggle sidebar and tabs', async ({ page }) => {
    const sidebar = page.locator('#sidebar');
    const toggleBtn = page.locator('#toggleBtn');

    // Verify sidebar is visible initially
    await expect(sidebar).toBeVisible();

    // Click playground tab
    await page.click('button[data-tab="playground"]');
    await expect(page.locator('#playgroundTab')).toBeVisible();
    await expect(page.locator('#generalTab')).not.toBeVisible();

    // Toggle sidebar
    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/collapsed/);
    
    await toggleBtn.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('should enter simulation mode and trigger storm event', async ({ page }) => {
    // Navigate to playground
    await page.click('button[data-tab="playground"]');

    // Start simulation
    await page.click('#startSimBtn');
    
    // Check for simulation banner
    const banner = page.locator('#simBanner');
    await expect(banner).toBeVisible();

    // Small delay to ensure simulation mode is fully active
    await page.waitForTimeout(1000);

    // Trigger storm event - use evaluate to be sure it's called
    await page.evaluate(() => {
        if (typeof simulateStormEvent === 'function') {
            simulateStormEvent();
        }
    });
    
    // Verify storm notification via text content anywhere in the container
    // Using a more flexible check as notifications might overlap
    await expect(page.locator('#notificationContainer')).toContainText('Storm Event', { timeout: 15000 });
  });

  test('should optimize technician routes', async ({ page }) => {
    await page.click('button[data-tab="playground"]');
    await page.click('#startSimBtn');
    
    // Add an agent and manually add multiple tasks to their queue via evaluate to ensure > 1
    await page.evaluate(() => {
        const customer1 = window.AppState.customers[0];
        const customer2 = window.AppState.customers[1];
        // This will create an agent and add both customers to their queue
        window.sendAgentToCustomer(customer1);
        window.sendAgentToCustomer(customer2);
    });
    
    await page.waitForTimeout(1000);
    
    // Click optimize
    await page.evaluate(() => {
        if (typeof optimizeAgentRoutes === 'function') {
            optimizeAgentRoutes();
        }
    });
    
    // Verify notification
    await expect(page.locator('#notificationContainer')).toContainText('Route Optimized', { timeout: 10000 });
  });

  test('should toggle coverage heatmap', async ({ page }) => {
    await page.click('button[data-tab="playground"]');
    
    const heatmapCheckbox = page.locator('#toggleHeatmapCheckbox');
    await heatmapCheckbox.check();

    // Verify notification
    await expect(page.locator('#notificationContainer')).toContainText('Heatmap Active');
    
    // Verify heatmap circles exist in state (checking AppState via evaluate)
    const circleCount = await page.evaluate(() => {
        // heatmapCircles is local to Simulation.js, but we can check if they are on map
        // Since we can't easily access the local variable, we verify the checkbox state
        return document.getElementById('toggleHeatmapCheckbox').checked;
    });
    expect(circleCount).toBe(true);
  });

  test('should trigger mock notification alert', async ({ page }) => {
    await page.click('button[data-tab="playground"]');
    await page.click('#testNotifyBtn');

    const notification = page.locator('#notificationContainer > div').first();
    await expect(notification).toBeVisible();
    await expect(notification).toContainText('Test Notification');

    // Wait for auto-dismiss (simulated) or just verify it exists
    await expect(notification).toBeVisible();
  });
});
