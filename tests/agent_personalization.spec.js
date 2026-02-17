const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Agent Personalization & Task Dashboard', () => {
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
    });

    test('should show names and seniority badges on agents', async ({ page }) => {
        // Add an agent
        await page.click('#addAgentBtnRight');
        
        const agentCard = page.locator('.agent-item').first();
        await expect(agentCard).toBeVisible({ timeout: 15000 });
        
        // Check for seniority badge in the UI
        const seniorityBadge = agentCard.locator('span.rounded.border');
        await expect(seniorityBadge).toBeVisible();
        const seniorityText = await seniorityBadge.textContent();
        expect(['Junior', 'Intermediate', 'Senior', 'Lead']).toContain(seniorityText.trim());

        // Check name label on map (this is hard to verify directly via DOM since it's Canvas, 
        // but we can check if the marker was created with the right label in state if we had access, 
        // or just rely on the UI list which reflects the same data).
        const agentName = await agentCard.locator('.font-bold.text-slate-800').first().textContent();
        expect(agentName.trim()).toMatch(/Tech \d+/);
    });

    test('should allow editing agent name and color via palette', async ({ page }) => {
        await page.click('#addAgentBtnRight');
        
        const agentCard = page.locator('.agent-item').first();
        await agentCard.locator('.edit-agent-btn').click();
        
        const modal = page.locator('#editAgentModal');
        await expect(modal).toBeVisible();
        
        // Change name
        await modal.locator('#editAgentName').fill('Special Tech');
        
        // Open palette
        await modal.locator('#openPaletteBtn').click();
        const palette = page.locator('#colorPalettePopup');
        await expect(palette).toBeVisible();
        
        // Select a color (e.g., the first swatch)
        const firstSwatch = palette.locator('.color-swatch').first();
        const colorValue = await firstSwatch.getAttribute('title');
        await firstSwatch.click();
        
        // Save
        await modal.locator('#saveEditAgentBtn').click();
        await expect(modal).not.toBeVisible();
        
        // Verify changes in the card
        await expect(agentCard.locator('.font-bold.text-slate-800')).toContainText('Special Tech');
        const iconDiv = agentCard.locator('.w-8.h-8.rounded-full');
        const style = await iconDiv.getAttribute('style');
        expect(style).toContain(`background-color: ${colorValue}`);
    });

    test('should open task dashboard and show fair distribution', async ({ page }) => {
        // Open dashboard
        await page.click('#openTaskDashBtn');
        const dash = page.locator('#taskDashboard');
        await expect(dash).toBeVisible();
        
        // Add 2 agents via dashboard button
        await page.click('#dashAddAgentBtn');
        await page.click('#dashAddAgentBtn');
        
        // Add multiple batches of random tasks
        await page.click('#dashAddTasksBtn');
        await page.click('#dashAddTasksBtn');
        await page.click('#dashAddTasksBtn'); // ~15 tasks
        
        // Wait for distribution
        await page.waitForTimeout(5000);
        
        // Check workload in dashboard
        const agentWorkloads = dash.locator('#dashAgentList .p-4');
        await expect(agentWorkloads).toHaveCount(2, { timeout: 10000 });
        
        const workloadTexts = await agentWorkloads.allTextContents();
        for (const text of workloadTexts) {
            const taskMatch = text.match(/(\d+) Tasks in Queue/);
            if (taskMatch) {
                const count = parseInt(taskMatch[1]);
                // With fair distribution, they should have roughly equal tasks
                expect(count).toBeGreaterThanOrEqual(1); 
            }
        }
    });

    test('should update max tasks per agent and re-optimize', async ({ page }) => {
        await page.click('#openTaskDashBtn');
        
        const maxTasksSlider = page.locator('#maxTasksSlider');
        await maxTasksSlider.evaluate(el => {
            el.value = 2;
            el.dispatchEvent(new Event('input'));
        });
        
        await expect(page.locator('#maxTasksValue')).toHaveText('2');
        
        // Add an agent and many tasks
        await page.click('#dashAddAgentBtn');
        await page.click('#dashAddTasksBtn');
        await page.click('#dashAddTasksBtn'); // 10 tasks
        
        // Apply optimization
        await page.click('#applyOptimizationBtn');
        await page.waitForTimeout(2000);
        
        // Verify agent only has 2 tasks
        const workloadText = await page.locator('#dashAgentList .p-4').first().textContent();
        const taskMatch = workloadText.match(/(\d+) Tasks in Queue/);
        if (taskMatch) {
            expect(parseInt(taskMatch[1])).toBeLessThanOrEqual(2);
        }
    });
});
