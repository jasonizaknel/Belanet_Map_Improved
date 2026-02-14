const { test, expect } = require('@playwright/test');

test.describe('UI Font Improvements', () => {
  test.setTimeout(60000);
  test.beforeEach(async ({ page }) => {
    // Navigate to the local server
    await page.goto('http://localhost:5505/map.html');
  });

  test('should use Inter font for body and sidebar', async ({ page }) => {
    // Check body font
    const bodyFont = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toContain('Inter');

    // Check sidebar font
    const sidebarFont = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      return window.getComputedStyle(sidebar).fontFamily;
    });
    expect(sidebarFont).toContain('Inter');
  });

  test('should use Inter font for inputs and buttons in sidebar', async ({ page }) => {
    // Check search input font
    const inputFont = await page.evaluate(() => {
      const input = document.getElementById('searchInput');
      return window.getComputedStyle(input).fontFamily;
    });
    expect(inputFont).toContain('Inter');

    // Check a tab button font
    const buttonFont = await page.evaluate(() => {
      const button = document.querySelector('.tabBtn');
      return window.getComputedStyle(button).fontFamily;
    });
    expect(buttonFont).toContain('Inter');
  });
});
