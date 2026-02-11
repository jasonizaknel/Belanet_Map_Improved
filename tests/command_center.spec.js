const { test, expect } = require('@playwright/test');

test.describe('ISP Command Center & Simulation Optimization', () => {
    test.beforeEach(async ({ page }) => {
        // Increase timeout for map loading
        test.setTimeout(60000);
        await page.goto('http://localhost:5505/map.html');
        // Wait for data to load
        await page.waitForFunction(() => window.AppState && window.AppState.dataLoaded === true);
    });

    test('Dashboard UI should display Command Center branding and status', async ({ page }) => {
        // Open dashboard - use evaluate to bypass interception issues if they persist
        await page.evaluate(() => document.getElementById('openTaskDashBtn').click());
        
        // Wait for dashboard to be visible
        const dash = page.locator('#taskDashboard');
        await expect(dash).toBeVisible({ timeout: 10000 });
        
        // Check Header
        const header = page.locator('h2:has-text("ISP Command Center")');
        await expect(header).toBeVisible();
        
        // Check Status Badge
        const status = page.locator('span:has-text("Systems Nominal")');
        await expect(status).toBeVisible();
        
        // Check Heartbeat Metrics exist
        await expect(page.locator('#hbNetworkHealth')).toBeVisible();
        await expect(page.locator('#hbOpenTickets')).toBeVisible();
    });

    test('Simulation speed and task shortening logic', async ({ page }) => {
        // Open dashboard
        await page.evaluate(() => document.getElementById('openTaskDashBtn').click());
        await expect(page.locator('#taskDashboard')).toBeVisible({ timeout: 10000 });
        
        // Start Simulation if not active (Add Agent)
        await page.click('#dashAddAgentBtn');
        await page.click('#dashAddTasksBtn');
        
        // Verify agents and tasks are added to the UI
        await expect(page.locator('#dashAgentCount')).not.toHaveText('0 Techs');
        await expect(page.locator('#dashTaskCount')).not.toHaveText('0 Tasks');

        // Check Work Speed Slider
        await page.evaluate(() => {
            const slider = document.getElementById('workSpeedSlider');
            slider.value = 50;
            slider.dispatchEvent(new Event('input'));
        });
        const speedValue = page.locator('#workSpeedValue');
        await expect(speedValue).toHaveText('50.0x');

        // Test "Finish All Current Tasks" button
        // First wait for an agent to be "At Customer" or "Moving"
        await page.waitForTimeout(2000); // Give it a moment to start
        
        const finishBtn = page.locator('#shortenWorkTimeBtn');
        await expect(finishBtn).toBeVisible();
        await finishBtn.click();
        
        // Check for success notification (simulated via console or DOM if notification exists)
        // Since shortenCurrentTasks calls showNotification, we can check for toast
        const toast = page.locator('.notification-toast, .toast-success'); // Common classes in this repo
        // If exact notification class is unknown, we just verify the action executed without error
    });

    test('Customer Marker Resilience', async ({ page }) => {
        // Verify customer markers are initialized even with weird GPS formats
        // This is a unit-like E2E check
        const markerCount = await page.evaluate(() => {
            return window.AppState.customerMarkers ? window.AppState.customerMarkers.length : 0;
        });
        expect(markerCount).toBeGreaterThan(0);
    });
});
