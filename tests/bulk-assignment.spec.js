const { test, expect } = require('@playwright/test');

test.describe('Bulk Task Assignment', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5505/map.html');
        // Wait for map and data to load
        await page.waitForFunction(() => window.AppState && window.AppState.dataLoaded);
    });

    test('should add tasks to assignment from customer info window', async ({ page }) => {
        // 1. Add a member first
        await page.click('#rightToggleBtn');
        await page.click('#addMemberBtn');
        await page.click('#adminDropdown button:first-child');
        
        // 2. Click a customer on the list to show details (which makes autoAssignContainer visible)
        await page.click('.member-card:first-child');
        
        // 3. Find a customer with tasks and click it on the map
        // We'll simulate a click on a customer marker or use the list to find one
        const customerWithTasks = await page.evaluate(() => {
            return window.AppState.customers.find(c => c.tasks && c.tasks.length > 0);
        });
        
        expect(customerWithTasks).toBeDefined();
        
        // Click the marker for this customer
        // Since markers are Canvas, we'll use the AppState to trigger the click logic or find the marker
        await page.evaluate((id) => {
            const markerData = window.AppState.customerMarkers.find(m => m.customer.id === id);
            google.maps.event.trigger(markerData.marker, 'click');
        }, customerWithTasks.id);
        
        // 4. Check if info window is open and has the button
        const assignBtn = page.locator('button:has-text("Add Tasks to Assignment")');
        await expect(assignBtn).toBeVisible();
        
        // 5. Click the button
        await assignBtn.click();
        
        // 6. Verify ID is in the textarea
        const textarea = page.locator('#autoAssignInput');
        await expect(textarea).not.toBeEmpty();
        
        const taskIds = customerWithTasks.tasks.map(t => String(t.ID || t.id));
        const textareaValue = await textarea.inputValue();
        for (const id of taskIds) {
            expect(textareaValue).toContain(id);
        }
    });

    test('should toggle bulk select mode and add tasks by clicking markers', async ({ page }) => {
        // 1. Add a member and show details
        await page.click('#rightToggleBtn');
        await page.click('#addMemberBtn');
        await page.click('#adminDropdown button:first-child');
        await page.click('.member-card:first-child');
        
        // 2. Toggle bulk select
        await page.click('#toggleBulkSelect');
        await expect(page.locator('#bulkSelectHint')).toBeVisible();
        
        // 3. Click two different customers with tasks
        const customers = await page.evaluate(() => {
            return window.AppState.customers.filter(c => c.tasks && c.tasks.length > 0).slice(0, 2);
        });
        
        for (const customer of customers) {
            await page.evaluate((id) => {
                const markerData = window.AppState.customerMarkers.find(m => m.customer.id === id);
                google.maps.event.trigger(markerData.marker, 'click');
            }, customer.id);
        }
        
        // 4. Verify all task IDs are in textarea
        const textarea = page.locator('#autoAssignInput');
        const textareaValue = await textarea.inputValue();
        
        for (const customer of customers) {
            for (const task of customer.tasks) {
                expect(textareaValue).toContain(String(task.ID || task.id));
            }
        }
    });
});
