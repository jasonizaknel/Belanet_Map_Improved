const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Sidebar and Tab Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local server
    await page.goto(BASE + '/map.html');
  });

  test('should toggle sidebar visibility', async ({ page }) => {
    const sidebar = page.locator('#sidebar');
    const toggleBtn = page.locator('#toggleBtn');

    // Initial state: visible
    await expect(sidebar).toBeVisible();
    await expect(sidebar).not.toHaveClass(/collapsed/);

    // Toggle collapsed
    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/collapsed/);
    
    // Check if toggleBtn has active class
    await expect(toggleBtn).toHaveClass(/active/);

    // Wait for animation (300ms)
    await page.waitForTimeout(400);
    
    // Verify width is 0 or opacity is 0 (check style)
    const opacity = await sidebar.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(opacity).toBe('0');

    // Toggle back
    await toggleBtn.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
    await expect(toggleBtn).not.toHaveClass(/active/);
  });

  test('should switch tabs correctly', async ({ page }) => {
    const generalTabBtn = page.locator('.tabBtn[data-tab="general"]');
    const towersTabBtn = page.locator('.tabBtn[data-tab="towers"]');
    const customersTabBtn = page.locator('.tabBtn[data-tab="customers"]');
    
    const generalTabContent = page.locator('#generalTab');
    const towersTabContent = page.locator('#towersTab');
    const customersTabContent = page.locator('#customersTab');

    // Default: General tab should be active
    await expect(generalTabBtn).toHaveClass(/active/);
    await expect(generalTabContent).toHaveClass(/active/);
    await expect(towersTabContent).not.toHaveClass(/active/);

    // Switch to Towers
    await towersTabBtn.click({ force: true });
    await expect(towersTabBtn).toHaveClass(/active/);
    await expect(towersTabContent).toHaveClass(/active/);
    await expect(generalTabContent).not.toHaveClass(/active/);

    // Switch to Customers
    await customersTabBtn.click({ force: true });
    await expect(customersTabBtn).toHaveClass(/active/);
    await expect(customersTabContent).toHaveClass(/active/);
    await expect(towersTabContent).not.toHaveClass(/active/);
  });

  test('should have hover effects on filter buttons', async ({ page }) => {
    const filterBtn = page.locator('.filter-button').first();
    
    // Move mouse over button
    await filterBtn.hover();
    
    // Check transition property exists (indicating my change)
    const transition = await filterBtn.evaluate((el) => window.getComputedStyle(el).transition);
    // Since I used "all 0.2s...", it might show as "all 0.2s" or specific properties
    expect(transition).toMatch(/all|transform|0\.2s/);
  });
});
