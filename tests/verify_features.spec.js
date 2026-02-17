import { test, expect } from '@playwright/test';
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test('Verify Agent Customization and Dashboard', async ({ page }) => {
    test.setTimeout(60000);
    console.log('Navigating to map.html...');
    await page.goto(BASE + '/map.html');
    
    console.log('Waiting for Playground tab...');
    await page.waitForSelector('.tabBtn[data-tab="playground"]', { state: 'visible' });
    await page.click('.tabBtn[data-tab="playground"]');
    
    console.log('Waiting for Start Simulation button...');
    await page.waitForSelector('#startSimBtn', { state: 'visible' });
    await page.click('#startSimBtn');
    
    console.log('Adding Random Agent...');
    await page.waitForSelector('#addAgentBtn', { state: 'visible' });
    await page.click('#addAgentBtn');
    
    console.log('Checking sidebar state...');
    const sidebar = page.locator('#rightSidebar');
    await page.waitForTimeout(2000); // Wait for simulation to init
    if (await sidebar.getAttribute('class').then(cls => cls.includes('collapsed'))) {
        console.log('Opening right sidebar...');
        await page.click('#rightToggleBtn');
        await page.waitForTimeout(1000);
    }
    
    console.log('Waiting for agent item...');
    await page.waitForSelector('.agent-item', { state: 'visible', timeout: 10000 });
    await page.screenshot({ path: 'sidebar_open.png' });
    
    console.log('Opening Edit Agent Modal...');
    await page.click('.agent-item .edit-agent-btn', { force: true });
    await page.waitForSelector('#editAgentModal', { state: 'visible' });
    
    console.log('Taking screenshot of Edit Modal...');
    await page.screenshot({ path: 'edit_agent_modal.png' });
    
    // Open Palette
    await page.click('#openPaletteBtn');
    await page.waitForSelector('#colorPalettePopup', { state: 'visible' });
    await page.screenshot({ path: 'color_palette.png' });
    
    // Close Palette (click outside or close btn)
    await page.click('#closePaletteBtn');
    
    // Save Edit
    await page.click('#saveEditAgentBtn');
    
    // Open Dashboard
    await page.click('#openTaskDashBtn');
    await page.waitForSelector('#taskDashboard', { state: 'visible' });
    
    // Take screenshot of Dashboard
    await page.screenshot({ path: 'task_dashboard.png' });
    
    // Close Dashboard
    await page.click('#closeTaskDashBtn');
});
