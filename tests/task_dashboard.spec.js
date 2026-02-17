const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Task Management Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the map application
        await page.goto(BASE + '/map.html');
        
        // Wait for AppState to be initialized
        await page.waitForFunction(() => window.AppState && window.AppState.markersInitialized);
    });

    test('should open and display correct metrics in the dashboard', async ({ page }) => {
        // 1. Open the dashboard from the right sidebar
        const openBtn = page.locator('#openTaskDashBtn');
        await expect(openBtn).toBeVisible();
        await openBtn.click({ force: true });

        // 2. Verify dashboard visibility
        const dashboard = page.locator('#taskDashboard');
        await expect(dashboard).not.toHaveClass(/hidden/);

        // 3. Check ISP Heartbeat metrics
        await expect(page.locator('#hbNetworkHealth')).toBeVisible();
        await expect(page.locator('#hbOpenTickets')).toBeVisible();
        await expect(page.locator('#hbCriticalTasks')).toBeVisible();
        
        // 4. Verify Workload Grid
        // Ensure there's a section for agent workload
        const agentList = page.locator('#dashAgentList');
        await expect(agentList).toBeVisible();

        // 5. Verify Task Priority Queue
        const taskList = page.locator('#dashTaskList');
        await expect(taskList).toBeVisible();
    });

    test('should correctly identify and highlight long-standing tasks', async ({ page }) => {
        // Inject a long-standing task into AppState for testing
        await page.evaluate(() => {
            const thirtyOneDaysAgo = new Date();
            thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
            
            if (!window.AppState.tasks) window.AppState.tasks = [];
            
            window.AppState.tasks.push({
                id: 'TEST-LONG-STANDING',
                Customer: 'Test Customer Legacy',
                priority: 'Critical',
                status: 'New',
                date_created: thirtyOneDaysAgo.toISOString(),
                description: 'This is a long standing test task'
            });
            
            // Trigger dashboard update
            if (typeof window.updateDashboardContent === 'function') {
                window.updateDashboardContent();
            }
        });

        // Open dashboard
        await page.click('#openTaskDashBtn', { force: true });

        // Check if the legacy task is highlighted in purple
        const legacyTask = page.locator('div:has-text("Test Customer Legacy")').first();
        // The div container should have the purple background class
        await expect(legacyTask.locator('.. >> ..')).toHaveClass(/bg-purple-50/);
        
        // Verify it says "Legacy" or "Extended Period"
        await expect(page.locator('text=Legacy')).toBeVisible();
    });

    test('should exclude long-standing tasks from critical count', async ({ page }) => {
        const counts = await page.evaluate(() => {
            const thirtyOneDaysAgo = new Date();
            thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
            
            // Clear existing tasks for predictable test
            window.AppState.tasks = [
                { id: 'C1', priority: 'Critical', date_created: new Date().toISOString() }, // Normal Critical
                { id: 'C2', priority: 'Critical', date_created: thirtyOneDaysAgo.toISOString() } // Long standing Critical
            ];
            
            window.updateDashboardContent();
            
            return {
                total: document.getElementById('hbOpenTickets').innerText,
                critical: document.getElementById('hbCriticalTasks').innerText
            };
        });

        // Total should be 2, but Critical should be 1 (because C2 is long-standing)
        expect(counts.total).toBe("2");
        expect(counts.critical).toBe("1");
    });
});
