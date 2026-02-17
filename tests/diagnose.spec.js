const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test('Verify simulation and admin dropdown', async ({ page }) => {
    test.setTimeout(120000);
    
    await page.goto(BASE + '/map.html');
    
    // Wait for AppState to be initialized
    await page.waitForFunction(() => window.AppState && window.AppState.config);
    
    console.log('Page loaded and AppState initialized');

    // 1. Check Admin Dropdown
    console.log('Checking Admin Dropdown...');
    
    // Expand right sidebar first if it's collapsed
    const isCollapsed = await page.evaluate(() => document.getElementById('rightSidebar').classList.contains('collapsed'));
    if (isCollapsed) {
        console.log('Expanding right sidebar...');
        await page.click('#rightToggleBtn', { force: true });
    }

    await page.click('#addMemberBtn', { force: true });
    const adminDropdown = page.locator('#adminDropdown');
    
    await page.waitForTimeout(1000);
    
    const adminCount = await adminDropdown.locator('button, div').count();
    console.log(`Admin dropdown items: ${adminCount}`);
    
    // 2. Check Simulation Panel
    console.log('Checking Simulation Panel...');
    // Click Playground tab - using Play instead of Playground
    await page.click('.tabBtn:has-text("Play")', { force: true });
    
    // Click Start Simulation
    await page.click('#startSimBtn', { force: true });
    await page.waitForTimeout(1000);
    
    // Check if agentList is visible and what it contains
    const agentList = page.locator('#agentList');
    const isAgentListVisible = await agentList.isVisible();
    console.log(`Agent list visible: ${isAgentListVisible}`);
    
    const agentListContent = await agentList.innerHTML();
    console.log(`Agent list HTML length: ${agentListContent.length}`);
    
    // Try adding an agent
    await page.click('#addAgentBtn', { force: true });
    await page.waitForTimeout(1000);
    
    const agentItemsCount = await agentList.locator('.agent-item').count();
    console.log(`Agent items after adding: ${agentItemsCount}`);
});
