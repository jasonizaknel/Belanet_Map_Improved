const { test, expect } = require('@playwright/test');
const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5505}`;

test.describe('Operational Dashboard V2 - ISP Heartbeat & Priority Queue', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the map application
        await page.goto(BASE + '/map.html');
        
        // Wait for AppState to be initialized
        await page.waitForFunction(() => window.AppState && window.AppState.dataLoaded);
        
        // Ensure right sidebar is open
        await page.evaluate(() => {
            const sidebar = document.getElementById('rightSidebar');
            if (sidebar && sidebar.classList.contains('collapsed')) {
                const toggleBtn = document.getElementById('rightToggleBtn');
                if (toggleBtn) toggleBtn.click();
            }
        });
        
        // Open the dashboard
        await page.click('#openTaskDashBtn', { force: true });
        
        // Wait for dashboard to be visible
        await expect(page.locator('#taskDashboard')).toBeVisible();
    });

    test('should display ISP Heartbeat metrics with correct values', async ({ page }) => {
        // Inject predictable data
        await page.evaluate(() => {
            const now = Date.now();
            const twoDaysAgo = new Date(now - (2 * 24 * 3600 * 1000)).toISOString();
            const thirtyOneDaysAgo = new Date(now - (31 * 24 * 3600 * 1000)).toISOString();
            
            window.AppState.tasks = [
                { id: 101, Title: 'Recent Critical', priority: 'critical', date_created: twoDaysAgo, status: 'New' },
                { id: 102, Title: 'Recent Normal', priority: 'low', date_created: twoDaysAgo, status: 'New' },
                { id: 103, Title: 'Legacy Critical', priority: 'critical', date_created: thirtyOneDaysAgo, status: 'New' }
            ];
            
            // Force update
            if (typeof window.updateOperationalDashboard === 'function') {
                window.updateOperationalDashboard();
            }
        });

        // Check Open Tickets (should be 3)
        await expect(page.locator('#hbOpenTickets')).toHaveText('3');
        
        // Check Critical Tasks (should be 1 - Legacy Critical is excluded from critical count)
        await expect(page.locator('#hbCriticalTasks')).toHaveText('1');
    });

    test('should highlight legacy tasks in purple in the priority queue', async ({ page }) => {
        await page.evaluate(() => {
            const now = Date.now();
            const thirtyOneDaysAgo = new Date(now - (31 * 24 * 3600 * 1000)).toISOString();
            
            window.AppState.tasks = [
                { id: 201, Title: 'Legacy Task Test', priority: 'low', date_created: thirtyOneDaysAgo, status: 'New', Customer: 'Legacy Customer' }
            ];
            
            if (typeof window.updateOperationalDashboard === 'function') {
                window.updateOperationalDashboard();
            }
        });

        // Wait for the task to appear in the list
        const legacyTag = page.locator('span:has-text("Legacy Task")');
        await expect(legacyTag).toBeVisible();
        
        // Check for purple classes
        await expect(legacyTag).toHaveClass(/text-purple-700/);
        await expect(legacyTag).toHaveClass(/bg-purple-100/);
    });

    test('should show correct network health based on tower status', async ({ page }) => {
        await page.evaluate(() => {
            window.AppState.towers = [
                { id: 'T1', lat: -25, lng: 28 },
                { id: 'T2', lat: -25.1, lng: 28.1 }
            ];
            
            // Mock getTowerStatusColor to return red for T1
            const originalGetTowerStatusColor = window.getTowerStatusColor;
            window.getTowerStatusColor = (id) => {
                if (id === 'T1') return "#d32f2f"; // Red
                return "#388e3c"; // Green
            };
            
            if (typeof window.updateOperationalDashboard === 'function') {
                window.updateOperationalDashboard();
            }
        });

        // 1 out of 2 towers UP = 50% health
        await expect(page.locator('#hbNetworkHealth')).toHaveText('50%');
        await expect(page.locator('#hbNetworkHealth')).toHaveClass(/text-red-600/);
    });

    test('should generate and display customer markers on the map', async ({ page }) => {
        // We already wait for markersInitialized in beforeEach, but let's check count
        const markerCount = await page.evaluate(() => {
            return window.AppState.customerMarkers.filter(m => m.marker.getMap() !== null).length;
        });
        
        // Since we wait for markersInitialized, there should be some markers on the map
        // (depending on the Data/customers.json which we know has data)
        expect(markerCount).toBeGreaterThan(0);
    });
});
