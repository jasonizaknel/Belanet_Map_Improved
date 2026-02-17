const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Simulation Features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE + '/map.html');
        // Wait for map and tab navigation to be ready
        await page.waitForSelector('.tabBtn[data-tab="playground"]', { timeout: 30000 });
        await expect(page.locator('#map')).toBeVisible({ timeout: 30000 });
    });

    test('should start simulation and show agent management panel', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        await expect(page.locator('#simBanner')).toBeVisible({ timeout: 15000 });
        
        // Ensure sidebar is open
        const rightSidebar = page.locator('#rightSidebar');
        if (await rightSidebar.evaluate(el => el.classList.contains('collapsed'))) {
            await page.click('#rightToggleBtn');
        }
        
        await expect(page.locator('#rightSidebarHeader span').first()).toContainText('Agent Management', { timeout: 15000 });
        
        const agentList = page.locator('#agentList');
        await expect(agentList).toBeVisible();
        await expect(agentList.locator('span', { hasText: 'Active Simulation Agents' })).toBeVisible();
        
        // Add agent via the panel button
        await page.click('#addAgentBtnRight');
        await expect(page.locator('.agent-item').first()).toBeVisible({ timeout: 15000 });
    });

    test('should trigger random tasks scenario', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        // Add an agent first
        await page.click('#addAgentBtn'); 
        
        await page.click('#simRandomTasksBtn');
        
        // Check for notification
        await expect(page.locator('#notificationContainer')).toContainText('Tasks Added', { timeout: 20000 });
    });

    test('should trigger tower outage scenario', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        // Add an agent
        await page.click('#addAgentBtn');
        
        await page.click('#simTowerOutageBtn');
        
        // Check for notification
        const notification = page.locator('#notificationContainer');
        await expect(notification).toBeVisible({ timeout: 20000 });
        const text = await notification.textContent();
        expect(text).toMatch(/Emergency Reroute|No Qualified Techs/);
    });

    test('should trigger storm event scenario', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        await page.click('#simStormBtn');
        
        await expect(page.locator('#notificationContainer')).toContainText('Storm Event', { timeout: 20000 });
    });

    test('should toggle coverage heatmap', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        
        const heatmapCheckbox = page.locator('#toggleHeatmapCheckbox');
        await heatmapCheckbox.scrollIntoViewIfNeeded();
        // Use click instead of check as it's more reliable for styled checkboxes
        await heatmapCheckbox.click();
        
        await expect(page.locator('#notificationContainer')).toContainText('Heatmap Active', { timeout: 15000 });
    });

    test('should update simulation speed', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        
        const speedSlider = page.locator('#simSpeedSlider');
        await speedSlider.evaluate(el => {
            el.value = 5.0;
            el.dispatchEvent(new Event('input'));
        });
        
        await expect(page.locator('#speedValueDisplay')).toHaveText('5.0x', { timeout: 10000 });
    });

    test('should assign tasks and show queue on card click', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        // Add an agent
        await page.click('#addAgentBtn');
        await expect(page.locator('.agent-item').first()).toBeVisible({ timeout: 15000 });

        // Add tasks
        await page.click('#simRandomTasksBtn');
        await expect(page.locator('#notificationContainer')).toContainText('Tasks Added', { timeout: 20000 });

        // Wait for redistribution and check if agent card shows tasks
        // We need to wait a bit for the distance matrix and routing to complete
        await page.waitForTimeout(5000); 

        const agentCard = page.locator('.agent-item').first();
        
        // Click card to expand queue
        await agentCard.click();
        
        // Verify queue is visible (remove hidden class)
        const queueDiv = agentCard.locator('div[id^="queue-"]');
        await expect(queueDiv).toBeVisible();
        
        // Check if there are tasks in the queue (not "No pending tasks")
        const queueText = await queueDiv.textContent();
        expect(queueText).not.toContain('No pending tasks');
    });

    test('should stop simulation and restore state', async ({ page }) => {
        await page.click('.tabBtn[data-tab="playground"]');
        await page.click('#startSimBtn');
        await page.click('#stopSimBtn');
        
        await expect(page.locator('#simBanner')).not.toBeVisible({ timeout: 15000 });
        const sidebarTitle = page.locator('#rightSidebarHeader span').first();
        await expect(sidebarTitle).toContainText('Team Management', { timeout: 15000 });
    });
});
