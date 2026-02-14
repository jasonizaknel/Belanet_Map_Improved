const { test, expect } = require('@playwright/test');

test('Dashboard V3 Improvements: Strategy Toggle, Animations, and Scaling', async ({ page }) => {
  test.setTimeout(120000);
  
  // 1. Setup and Load
  await page.goto('http://localhost:5505/map.html');
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for map and simulation to be ready
  await page.waitForFunction(() => typeof AppState !== 'undefined' && AppState.map, { timeout: 60000 });
  
  // 2. Open Dashboard and Verify Initial Animations
  console.log('Opening dashboard...');
  
  // Need to open the sidebar first if it's collapsed
  await page.evaluate(() => {
    const sidebar = document.getElementById('rightSidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) {
        const toggle = document.getElementById('rightToggleBtn');
        if (toggle) toggle.click();
    }
  });

  await page.waitForTimeout(500);

  // Use evaluate to click the button to bypass "intercepts pointer events"
  await page.evaluate(() => {
    const btn = document.getElementById('openTaskDashBtn');
    if (btn) btn.click();
    else throw new Error('openTaskDashBtn not found');
  });
  
  await page.waitForSelector('#taskDashboard:not(.hidden)', { timeout: 10000 });
  
  // Check if opening flag is set
  const isOpening = await page.evaluate(() => AppState.dashboardOpening);
  expect(isOpening).toBe(true);

  // Add some data to see the cards and their animations
  await page.evaluate(() => {
    if (typeof startSimulation === 'function' && !AppState.simulation.active) {
      startSimulation();
    }
    if (typeof addRandomAgent === 'function') addRandomAgent();
    if (typeof simulateRandomTasks === 'function') simulateRandomTasks();
    if (typeof triggerStateChange === 'function') {
        triggerStateChange({ type: 'test_populate' });
    }
  });

  // Check for the animation classes on cards during opening
  // fadeInUp for agents, fadeInRight for tasks
  const agentCard = page.locator('.tech-grid-item').first();
  const taskCard = page.locator('.task-dashboard-card').first();
  
  await expect(agentCard).toHaveClass(/animate__fadeInUp/);
  await expect(taskCard).toHaveClass(/animate__fadeInRight/);

  // 3. Wait for opening period to end and check state change animation
  console.log('Waiting for opening animation period to end...');
  await page.waitForTimeout(1500); // dashboard-opening removed after 1s
  
  const isStillOpening = await page.evaluate(() => AppState.dashboardOpening);
  expect(isStillOpening).toBe(false);

  // Trigger a state change (e.g., search or filter)
  await page.evaluate(() => {
    const searchInput = document.getElementById('dashTaskSearch');
    if (searchInput) {
        searchInput.value = ''; // Ensure we see cards
        searchInput.dispatchEvent(new Event('input'));
    }
    // Also trigger a state change explicitly
    window.dispatchEvent(new CustomEvent('stateChanged', { detail: { type: 'test_refresh' } }));
  });
  await page.waitForTimeout(500);

  // Now cards should have subtle fadeIn instead of directional animations
  const updatedTaskCard = page.locator('.task-dashboard-card').first();
  await expect(updatedTaskCard).toHaveClass(/animate__fadeIn/);
  await expect(updatedTaskCard).not.toHaveClass(/animate__fadeInRight/);
  console.log('Animations verified: correctly switched from directional to subtle');

  // 4. Verify Strategy Panel Toggle
  console.log('Testing Strategy Panel Toggle...');
  const strategyPanel = page.locator('#strategyPanel');
  const toggleBtn = page.locator('#toggleStrategyBtn');

  // Initially visible
  await expect(strategyPanel).toBeVisible();
  // Check that the class is present (added by sync logic)
  await expect(toggleBtn).toHaveClass(/(^|\s)bg-primary-600(\s|$)/);
  
  // Toggle it OFF
  await toggleBtn.click();
  await expect(strategyPanel).toBeHidden();
  const classesOff = await toggleBtn.getAttribute('class');
  expect(classesOff).not.toMatch(/(^|\s)bg-primary-600(\s|$)/);

  // Toggle it ON
  await toggleBtn.click();
  await expect(strategyPanel).toBeVisible();
  await expect(toggleBtn).toHaveClass(/(^|\s)bg-primary-600(\s|$)/);
  console.log('Strategy Panel toggle verified');

  // 5. Verify Grid Scaling and Layout Stability
  console.log('Testing Grid Scaling...');
  const taskList = page.locator('#dashTaskList');
  const teamPanel = page.locator('.w-96.dashboard-card').last(); // The Team panel

  // Check initial width of team panel
  const initialTeamWidth = await teamPanel.evaluate(el => el.getBoundingClientRect().width);
  expect(initialTeamWidth).toBeCloseTo(384, 0); // w-96 = 24rem = 384px

  // Set grid to 4 columns
  await page.fill('#dashGridCols', '4');
  await page.dispatchEvent('#dashGridCols', 'input');
  
  // Verify grid has 4 columns
  const gridCount = await taskList.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(gridCount).toBe(4);

  // Ensure Team panel hasn't been pushed or shrunk significantly
  const finalTeamWidth = await teamPanel.evaluate(el => el.getBoundingClientRect().width);
  expect(finalTeamWidth).toBeCloseTo(384, 0); 
  
  // Check if team panel is still visible and in the same relative position
  const teamPos = await teamPanel.evaluate(el => el.getBoundingClientRect().left);
  const taskListPos = await taskList.evaluate(el => el.getBoundingClientRect().left);
  expect(teamPos).toBeGreaterThan(taskListPos);
  
  console.log('Grid scaling verified: cards adapted, Team panel remained stable');
});
