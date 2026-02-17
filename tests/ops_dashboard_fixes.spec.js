const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Ops Dashboard Fixes', () => {
    test.beforeEach(async ({ page }) => {
        // Go to the app
        await page.goto(BASE + '/map.html');
        // Wait for body to be ready
        await page.waitForSelector('body');
        // Inject a mock AppState if it doesn't exist or wait a bit
        await page.waitForFunction(() => window.AppState);
    });

    test('Comprehensive Dashboard Verification', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes for this big test
        
        // 1. Default map state and persistence
        const visibility = await page.evaluate(() => window.AppState.visibility);
        expect(visibility.towers).toBe(false);
        expect(visibility.links).toBe(false);

        await page.click('#toggleTowersBtn');
        await page.reload();
        await page.waitForFunction(() => window.AppState);
        const persistedVisibility = await page.evaluate(() => window.AppState.visibility);
        expect(persistedVisibility.towers).toBe(true);

        // 2. Dashboard Search and Filters
        await page.evaluate(() => document.getElementById('openTaskDashBtn').click());
        await page.waitForSelector('#taskDashboard:not(.hidden)');

        await page.evaluate(() => {
            window.AppState.simulation.active = true;
            window.simulateRandomTasks();
            window.triggerStateChange();
        });

        const initialTasks = await page.locator('#dashTaskList > div').count();
        expect(initialTasks).toBeGreaterThan(0);

        const firstTask = page.locator('#dashTaskList > div').first();
        const firstTaskName = await firstTask.locator('span.text-sm.font-black').textContent();
        await page.fill('#dashTaskSearch', firstTaskName);
        await page.waitForTimeout(500); 
        
        const filteredTasks = await page.locator('#dashTaskList > div').count();
        expect(filteredTasks).toBeGreaterThan(0);
        expect(filteredTasks).toBeLessThanOrEqual(initialTasks);

        // 3. Grid View Toggle
        const listContainer = page.locator('#dashTaskList');
        await page.evaluate(() => {
            window.AppState.dashboardGridView = true;
            window.updateOperationalDashboard();
        });
        await expect(listContainer).toHaveClass(/grid-cols-1/);
        
        await page.evaluate(() => {
            window.AppState.dashboardGridView = false;
            window.updateOperationalDashboard();
        });
        await expect(listContainer).toHaveClass(/space-y-4/);

        // 4. Drag and Drop UI Check
        await page.evaluate(() => {
            window.addRandomAgent();
            window.triggerStateChange();
        });

        const agentCard = page.locator('#dashAgentList > div').first();
        const taskCard = page.locator('#dashTaskList > div').first();
        
        const isDraggable = await taskCard.evaluate(el => el.draggable);
        expect(isDraggable).toBe(true);

        const hasDropZone = await agentCard.evaluate(el => el.classList.contains('drop-target'));
        expect(hasDropZone).toBe(true);
    });
});
