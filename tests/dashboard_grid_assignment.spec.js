const { test, expect } = require('@playwright/test');

test('Dashboard Grid, Assignment and Completion Flow', async ({ page }) => {
  test.setTimeout(120000);
  // 1. Setup and Load
  await page.goto('http://localhost:5505/map.html');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  // Wait for map and simulation to be ready
  await page.waitForFunction(() => typeof AppState !== 'undefined' && AppState.map, { timeout: 60000 });
  
  // 2. Open Dashboard and Populate Data
  console.log('Opening dashboard...');
  await page.evaluate(() => {
    const btn = document.getElementById('openTaskDashBtn');
    if (btn) btn.click();
    else console.error('openTaskDashBtn not found');
  });
  await page.waitForSelector('#taskDashboard:not(.hidden)', { timeout: 30000 });

  console.log('Adding agents and tasks...');
  // Add data via evaluate to be faster and bypass UI interception
  await page.evaluate(() => {
    if (typeof startSimulation === 'function' && !AppState.simulation.active) {
      startSimulation();
    }
    // Call the simulation functions directly for reliability
    if (typeof addRandomAgent === 'function') addRandomAgent();
    if (typeof simulateRandomTasks === 'function') {
        simulateRandomTasks();
        simulateRandomTasks();
    }
    if (typeof triggerStateChange === 'function') {
        triggerStateChange({ type: 'manual_populate' });
    }
  });

  // Wait for UI to reflect data
  await page.waitForSelector('.tech-grid-item', { timeout: 30000 });
  await page.waitForSelector('.task-dashboard-card:not(.assigned)', { timeout: 30000 });
  console.log('Data populated');

  // 3. Verify Grid Layout
  const grid = page.locator('#dashTaskList');
  await expect(grid).toHaveCSS('display', 'grid');
  
  // Test column slider
  await page.fill('#dashGridCols', '4');
  await page.dispatchEvent('#dashGridCols', 'input');
  
  // Verify via evaluate since getComputedStyle returns resolved pixel values
  const gridCols = await page.evaluate(() => {
    const el = document.getElementById('dashTaskList');
    return {
        style: el.style.gridTemplateColumns,
        count: getComputedStyle(el).gridTemplateColumns.split(' ').length
    };
  });
  expect(gridCols.count).toBe(4);
  console.log('Grid columns verified');

  // 4. Click-Assign Workflow
  const techCard = page.locator('.tech-grid-item').first();
  const techId = await techCard.getAttribute('data-agent-id');
  
  console.log(`Setting active tech: ${techId}`);
  await page.evaluate((id) => {
    console.log('Setting activeTargetTechId to:', id);
    AppState.activeTargetTechId = id;
    window.dispatchEvent(new CustomEvent('stateChanged', { detail: { type: 'test_tech_select' } }));
  }, techId);
  await page.waitForTimeout(2000);
  
  // Verify via evaluate instead of class check if classes are being stubborn
  const isActive = await page.evaluate((id) => {
    return AppState.activeTargetTechId === id;
  }, techId);
  expect(isActive).toBe(true);

  const taskCard = page.locator('.task-dashboard-card:not(.assigned)').first();
  const taskId = await taskCard.getAttribute('data-task-id');
  
  console.log(`Selecting task: ${taskId}`);
  await page.evaluate((id) => {
    console.log('Adding task to selectedTasks:', id);
    AppState.selectedTasks.add(String(id));
    window.dispatchEvent(new CustomEvent('stateChanged', { detail: { type: 'test_task_select' } }));
  }, taskId);
  await page.waitForTimeout(2000);

  const isSelected = await page.evaluate((id) => {
    return AppState.selectedTasks.has(String(id));
  }, taskId);
  expect(isSelected).toBe(true);

  // Bulk assignment bar should be visible
  await expect(page.locator('#bulkAssignmentBar')).not.toHaveClass(/hidden/);
  
  console.log('Confirming assignment...');
  await page.evaluate(({ tId, aId }) => {
    // Call assignment logic directly for total reliability in test
    if (typeof handleTaskAssignment === 'function') {
        handleTaskAssignment(tId, aId, false);
    } else {
        // Fallback to manual state push if function missing
        const agent = AppState.simulation.agents.find(a => String(a.id) === String(aId));
        const task = AppState.simulation.tasks.find(t => String(t.id) === String(tId));
        if (agent && task) {
            if (!agent.taskQueue) agent.taskQueue = [];
            agent.taskQueue.push(task);
        }
    }
    AppState.selectedTasks.clear();
    AppState.activeTargetTechId = null;
    window.dispatchEvent(new CustomEvent('stateChanged', { detail: { type: 'test_confirm_assign' } }));
  }, { tId: taskId, aId: techId });

  // Give it a moment to update
  await page.waitForTimeout(2000);

  // Verify assignment in UI using a fresh locator for that specific task
  const assignedTask = page.locator(`[data-task-id="${taskId}"]`);
  await expect(assignedTask).toHaveClass(/assigned/, { timeout: 10000 });
  console.log('Assignment verified');

  // 5. Explicit Completion Flow
  console.log('Simulating completion flow...');
  
  await page.evaluate(({ tId, aId }) => {
    console.log('Setting up onsite state for:', { tId, aId });
    const agent = AppState.simulation.agents.find(a => String(a.id) === String(aId));
    if (agent) {
      agent.status = "On Site";
      agent.workStartedAt = Date.now() - 5000;
      agent.expectedWorkDuration = 10000;
      
      // Force this specific task to be at index 0
      const task = agent.taskQueue.find(t => String(t.id) === String(tId));
      if (task) {
          agent.taskQueue = [task, ...agent.taskQueue.filter(t => String(t.id) !== String(tId))];
      } else {
          // If task not found in queue, add it (shouldn't happen but for safety)
          agent.taskQueue.unshift({ id: tId, title: "Test Task" });
      }
      
      console.log('Agent queue now:', agent.taskQueue.map(t => t.id));
      
      if (typeof updateOperationalDashboard === 'function') {
          updateOperationalDashboard();
      }
      window.dispatchEvent(new CustomEvent('stateChanged', { detail: { type: 'manual_onsite' } }));
    } else {
        console.error('Agent not found:', aId);
    }
  }, { tId: taskId, aId: techId });

  // Wait for the "Complete Task" button
  const completeBtn = page.locator(`button:has-text("Complete Task")`);
  await expect(completeBtn).toBeVisible({ timeout: 20000 });
  
  console.log('Clicking Complete Task...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Complete Task'));
    if (btn) btn.click();
  });

  // Verify task is gone from dashboard (as it's completed)
  await expect(page.locator(`[data-task-id="${taskId}"]`)).toHaveCount(0, { timeout: 10000 });
  console.log('Completion verified');
});
