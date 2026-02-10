const { test, expect } = require('@playwright/test');

test.describe('Team Management Sidebar', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5505/map.html');
    });

    test('should toggle the right sidebar', async ({ page }) => {
        const sidebar = page.locator('#rightSidebar');
        const toggleBtn = page.locator('#rightToggleBtn');

        // Initially collapsed
        await expect(sidebar).toHaveClass(/collapsed/);
        
        // Expand
        await toggleBtn.click();
        await expect(sidebar).not.toHaveClass(/collapsed/);
        
        // Collapse
        await toggleBtn.click();
        await expect(sidebar).toHaveClass(/collapsed/);
    });

    test('should add a member from the dropdown', async ({ page }) => {
        const addMemberBtn = page.locator('#addMemberBtn');
        const adminDropdown = page.locator('#adminDropdown');
        
        // Expand sidebar first
        await page.locator('#rightToggleBtn').click();

        await addMemberBtn.click({ force: true });
        await expect(adminDropdown).toBeVisible();

        // Click first admin in list (mock or real)
        const firstAdmin = adminDropdown.locator('button').first();
        const adminName = await firstAdmin.textContent();
        await firstAdmin.click({ force: true });

        // Verify member appears in the team list
        const memberCard = page.locator('#teamMemberList .member-card');
        await expect(memberCard).toBeVisible();
        await expect(memberCard).toContainText(adminName);
    });

    test('should expand to full width when clicking tabs', async ({ page }) => {
        // Expand sidebar
        await page.locator('#rightToggleBtn').click();

        // Add a member first
        await page.locator('#addMemberBtn').click({ force: true });
        await page.locator('#adminDropdown button').first().click({ force: true });
        
        // Open details
        await page.locator('.member-card').first().click({ force: true });
        await expect(page.locator('#memberDetails')).toBeVisible();

        // Click Info tab
        await page.locator('.detail-tab-btn[data-tab="info"]').click({ force: true });
        
        // Verify sidebar is expanded and app has class
        await expect(page.locator('#rightSidebar')).toHaveClass(/expanded/);
        await expect(page.locator('#app')).toHaveClass(/right-sidebar-expanded/);
        
        // Verify map is hidden (via CSS check or visibility)
        await expect(page.locator('#map')).not.toBeVisible();

        // Go back
        await page.locator('#backToTeamBtn').click({ force: true });
        await page.waitForTimeout(500); // Wait for potential animations or state changes
        await expect(page.locator('#rightSidebar')).not.toHaveClass(/expanded/);
        await expect(page.locator('#map')).toBeVisible();
    });

    test('should persist members after reload', async ({ page }) => {
        // Expand sidebar
        await page.locator('#rightToggleBtn').click();

        // Add member
        await page.locator('#addMemberBtn').click({ force: true });
        await page.locator('#adminDropdown button').first().click({ force: true });
        
        const adminName = await page.locator('.member-card .font-bold').first().textContent();

        // Reload
        await page.reload();
        
        // Expand sidebar again to see list
        await page.locator('#rightToggleBtn').click();

        // Verify still there
        const memberCard = page.locator('.member-card');
        await expect(memberCard).toBeVisible();
        await expect(memberCard).toContainText(adminName);
    });

    test('should remove a member from the list', async ({ page }) => {
        await page.locator('#rightToggleBtn').click();

        // Add member
        await page.locator('#addMemberBtn').click({ force: true });
        await page.locator('#adminDropdown button').first().click({ force: true });

        const memberCard = page.locator('.member-card').first();
        await expect(memberCard).toBeVisible();

        // Hover to show remove button and click it
        await memberCard.hover();
        await page.locator('.remove-member-btn').first().click({ force: true });

        // Verify card is gone
        await expect(memberCard).not.toBeVisible();
    });

    test('should toggle auto-assign UI', async ({ page }) => {
        await page.locator('#rightToggleBtn').click();
        await page.locator('#addMemberBtn').click({ force: true });
        await page.locator('#adminDropdown button').first().click({ force: true });
        await page.locator('.member-card').first().click({ force: true });

        // Initially hidden
        const autoAssignUI = page.locator('#autoAssignUI');
        await expect(autoAssignUI).not.toBeVisible();

        // Toggle on
        await page.locator('#toggleAutoAssignUI').click();
        await expect(autoAssignUI).toBeVisible();

        // Toggle off via Cancel
        await page.locator('#cancelAutoAssign').click();
        await expect(autoAssignUI).not.toBeVisible();
    });
});
