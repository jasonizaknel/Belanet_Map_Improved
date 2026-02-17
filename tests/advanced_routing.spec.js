const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Advanced Routing & Visual Indicators', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE + '/map.html');
        await page.waitForSelector('.tabBtn[data-tab="playground"]', { timeout: 30000 });
        await page.click('.tabBtn[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        // Ensure sidebar is open
        const rightSidebar = page.locator('#rightSidebar');
        if (await rightSidebar.evaluate(el => el.classList.contains('collapsed'))) {
            await page.click('#rightToggleBtn');
        }
        
        // Open Dashboard
        await page.click('#openTaskDashBtn');
        await expect(page.locator('#taskDashboard')).toBeVisible();
    });

    test('should respect high-def route depth setting', async ({ page }) => {
        // 1. Set HD Route Depth to 1
        const routeDepthSlider = page.locator('#routeDepthSlider');
        await routeDepthSlider.evaluate(el => {
            el.value = 1;
            el.dispatchEvent(new Event('input'));
        });
        await expect(page.locator('#routeDepthValue')).toHaveText('1');

        // 2. Add an agent and some tasks
        await page.click('#dashAddAgentBtn');
        await page.click('#dashAddTasksBtn');
        await page.click('#dashAddTasksBtn'); // ~10 tasks

        // 3. Wait for routing to complete and state to be populated
        await page.waitForFunction(() => {
            const agent = window.AppState.simulation.agents[0];
            return agent && agent.taskQueuePaths && agent.taskQueuePaths.length >= 2;
        }, { timeout: 15000 });

        // 4. Verify path density in AppState via console evaluation
        const pathDensities = await page.evaluate(() => {
            const agent = window.AppState.simulation.agents[0];
            return agent.taskQueuePaths.map(p => p.length);
        });

        expect(pathDensities).not.toBeNull();
        console.log('Path Densities:', pathDensities);

        // First path should be HD (high density > 10 points)
        // Second path and beyond should be fallback (low density ~6 points because steps=5 gives 6 points)
        expect(pathDensities[0]).toBeGreaterThan(10);
        if (pathDensities.length > 1) {
            expect(pathDensities[1]).toBeLessThanOrEqual(6);
        }
    });

    test('should show agent color indicators on customer markers', async ({ page }) => {
        // 1. Add agent and tasks
        await page.click('#dashAddAgentBtn');
        await page.click('#dashAddTasksBtn');
        
        // 2. Wait for redistribution and marker updates
        await page.waitForTimeout(4000);

        // 3. Verify marker label colors match agent color
        const markerVerification = await page.evaluate(() => {
            const agent = window.AppState.simulation.agents[0];
            const task = agent.taskQueue[0];
            const markerData = window.AppState.customerMarkers.find(m => m.customer.id === task.id);
            if (!markerData) return 'No Marker';
            
            const label = markerData.marker.getLabel();
            if (!label) return 'No Label';
            
            return {
                agentColor: agent.color,
                labelColor: label.color
            };
        });

        console.log('Marker Verification:', markerVerification);
        expect(markerVerification.labelColor).toBe(markerVerification.agentColor);
    });
});
