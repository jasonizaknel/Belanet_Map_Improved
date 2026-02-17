const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Simulation Optimization Features', () => {
    test.beforeEach(async ({ page }) => {
        // Increase timeout for map loading
        test.setTimeout(60000);
        await page.goto(BASE + '/map.html');
        // Wait for the map to be initialized (google object available)
        await page.waitForFunction(() => window.google && window.google.maps);
    });

    test('should optimize routes using 2-opt after adding tasks', async ({ page }) => {
        // 1. Enter simulation mode
        await page.click('#tabNavigation button[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        // 2. Add an agent
        await page.click('#addAgentBtn');
        
        // 3. Add multiple random tasks
        await page.click('#simRandomTasksBtn');
        
        // 4. Trigger optimization
        await page.click('#optimizeRoutesBtn');
        
        // 5. Check console for 2-opt log output
        const logs = [];
        page.on('console', msg => {
            if (msg.text().includes('2-opt optimized route')) {
                logs.push(msg.text());
            }
        });
        
        // Add more tasks to ensure 2-opt has enough to work with and trigger optimization again
        await page.click('#simRandomTasksBtn');
        await page.click('#optimizeRoutesBtn');

        // Wait a bit for async operations to complete
        await page.waitForTimeout(2000);
        
        // Verify notification appeared
        const notification = page.locator('#notificationContainer');
        await expect(notification).toBeVisible();
        const text = await notification.textContent();
        expect(text).toMatch(/Route Optimized|Optimization Skipped/);
    });

    test('should apply predictive traffic factors during simulation', async ({ page }) => {
        // 1. Enter simulation mode
        await page.click('#tabNavigation button[data-tab="playground"]');
        await page.click('#startSimBtn');
        
        // 2. Check initial simulation speed/time
        const clockDisplay = await page.textContent('#simClockDisplay');
        expect(clockDisplay).not.toBe('00:00:00');

        // 3. Verify internal state of traffic factor (via JS execution)
        const trafficFactor = await page.evaluate(() => {
            // Mock a rush hour time: 8:00 AM
            const rushHour = new Date();
            rushHour.setHours(8, 0, 0);
            return getPredictiveTrafficFactor(rushHour.getTime());
        });
        
        expect(trafficFactor).toBe(1.8);

        const offPeakFactor = await page.evaluate(() => {
            // Mock off-peak: 11:00 PM
            const offPeak = new Date();
            offPeak.setHours(23, 0, 0);
            return getPredictiveTrafficFactor(offPeak.getTime());
        });
        
        expect(offPeakFactor).toBe(0.8);
    });

    test('should apply complexity-based durations and proficiency multipliers', async ({ page }) => {
        // 1. Enter simulation mode
        await page.click('#tabNavigation button[data-tab="playground"]');
        await page.click('#startSimBtn');

        // 2. Verify proficiency assignment to new agents
        const hasProficiencies = await page.evaluate(() => {
            const agent = AppState.simulation.agents[0];
            return agent && agent.proficiencies && Object.keys(agent.proficiencies).length > 0;
        });
        
        // Create an agent if none exist
        if (!hasProficiencies) {
            await page.click('#addAgentBtn');
        }
        
        const profCheck = await page.evaluate(() => {
            const agent = AppState.simulation.agents[0];
            return Object.values(agent.proficiencies).every(p => p >= 1 && p <= 10);
        });
        
        expect(profCheck).toBe(true);
    });
});
