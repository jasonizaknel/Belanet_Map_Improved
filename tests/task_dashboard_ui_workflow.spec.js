const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:5505/map.html';

async function openDashboard(page) {
  await page.goto(BASE_URL);
  await page.waitForSelector('#openTaskDashBtn');
  await page.evaluate(() => { window.AppState = window.AppState || {}; if (!window.AppState.markersInitialized) window.AppState.markersInitialized = true; });
  await page.click('#openTaskDashBtn', { force: true });
  await page.waitForTimeout(100);
  await page.evaluate(() => { const d = document.getElementById('taskDashboard'); if (d && d.classList.contains('hidden')) d.classList.remove('hidden'); });
  await expect(page.locator('#taskDashboard')).toBeVisible();
}

async function seedAgents(page, agents) {
  await page.evaluate((agentsIn) => {
    if (!window.AppState.simulation) window.AppState.simulation = { active: true, agents: [], tasks: [] };
    window.AppState.simulation.active = true;
    window.AppState.simulation.agents = agentsIn.map((a, i) => ({
      id: a.id || `tech-${i+1}`,
      name: a.name || `Tech ${i+1}`,
      status: a.status || 'Idle',
      skills: a.skills || [],
      region: a.region || a.area || undefined,
      area: a.area || undefined,
      taskQueue: a.taskQueue || [],
      isLive: false,
      stats: a.stats || { completedTasks: [] }
    }));
    if (!window.aggregateAllAgents) return;
  }, agents);
  await page.evaluate(() => { if (typeof window.updateOperationalDashboard === 'function') window.updateOperationalDashboard(); });
}

async function seedTasks(page, tasks) {
  await page.evaluate((tasksIn) => {
    if (!window.AppState.simulation) window.AppState.simulation = { active: true, agents: [], tasks: [] };
    if (!Array.isArray(window.AppState.simulation.tasks)) window.AppState.simulation.tasks = [];
    const now = Date.now();
    tasksIn.forEach((t, i) => {
      window.AppState.simulation.tasks.push({
        id: t.id || `TASK-${Date.now()}-${i}`,
        description: t.description || t.title || `Task ${i+1}`,
        name: t.name || undefined,
        Customer: t.customer || `Customer ${i+1}`,
        priority: t.priority || 'Medium',
        status: t.status || 'open',
        requiredSkills: t.requiredSkills || [],
        createdTime: typeof t.createdTime === 'number' ? t.createdTime : (t.createdAt || now),
        updatedTime: typeof t.updatedTime === 'number' ? t.updatedTime : (t.updatedAt || t.createdAt || now)
      });
    });
  }, tasks);
  await page.evaluate(() => { if (typeof window.updateOperationalDashboard === 'function') window.updateOperationalDashboard(); });
}

async function attachShot(page, name, selector) {
  const loc = selector ? page.locator(selector).first() : page;
  await loc.waitFor({ state: 'visible' });
  const buf = await loc.screenshot({ animations: 'disabled' });
  await test.info().attach(name, { body: buf, contentType: 'image/png' });
}

test.describe('Task Dashboard UI & Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
    await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
    await page.evaluate(() => { if (window.localStorage) localStorage.clear(); });
  });

  test('Subtask 1: Task Card Information Hierarchy', async ({ page }) => {
    await seedTasks(page, [{ priority: 'Critical', customer: 'Alpha Co', description: 'Connectivity down', createdTime: Date.now() - 90 * 60 * 1000 }]);
    const card = page.locator('.task-dashboard-card').first();
    await expect(card.locator('.priority-badge')).toHaveText(/Critical/i);
    await expect(card.locator('.task-age-badge')).toBeVisible();
    await attachShot(page, 'subtask-1-card.png', '.task-dashboard-card');
  });

  test('Subtask 2: Task Age & SLA Risk Indicators', async ({ page }) => {
    await seedTasks(page, [{ priority: 'High', customer: 'Bravo Co', description: 'Packet loss', createdTime: Date.now() - 90 * 60 * 1000 }]);
    await page.fill('#slaAmberHoursInput', '1');
    await page.fill('#slaRedHoursInput', '2');
    await page.waitForTimeout(100);
    const amberDot = page.locator('.task-dashboard-card .sla-dot.sla-amber').first();
    await expect(amberDot).toBeVisible();
    await attachShot(page, 'subtask-2-sla.png', '.task-dashboard-card');
  });

  test('Subtask 3: Expandable Task Cards', async ({ page }) => {
    await seedTasks(page, [{ priority: 'Medium', customer: 'Charlie Co', description: 'Slow speed', createdTime: Date.now() - 30 * 60 * 1000 }]);
    const card = page.locator('.task-dashboard-card').first();
    await card.locator('.task-expand-btn').click();
    const expanded = card.locator('.task-expanded-content');
    await expect(expanded).toBeVisible();
    await attachShot(page, 'subtask-3-expanded.png', '.task-dashboard-card .task-expanded-content');
  });

  test('Subtask 4: Filtering & Sorting Controls', async ({ page }) => {
    const now = Date.now();
    await seedTasks(page, [
      { id: 'T1', priority: 'Critical', customer: 'Delta Ltd', status: 'open', createdTime: now - 60 * 60 * 1000 },
      { id: 'T2', priority: 'Low', customer: 'Echo Ltd', status: 'pending', createdTime: now - 2 * 60 * 60 * 1000 },
      { id: 'T3', priority: 'High', customer: 'Foxtrot Ltd', status: 'open', createdTime: now - 3 * 60 * 60 * 1000 }
    ]);
    await page.uncheck('#fPriLow');
    await page.selectOption('#dashTaskStatusFilter', 'open');
    await page.selectOption('#dashSortPreset', 'oldest');
    await page.waitForTimeout(100);
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('#dashTaskList .task-dashboard-card')).map(el => el.dataset.taskId));
    expect(ids[0]).toBe('T3');
    await attachShot(page, 'subtask-4-filters.png', '#dashFiltersBar');
  });

  test('Subtask 5: Density Toggle', async ({ page }) => {
    await seedTasks(page, [{ priority: 'Medium', customer: 'Golf Co' }]);
    await page.click('#densityCompactBtn');
    await expect(page.locator('#taskDashboard')).toHaveClass(/density-compact/);
    await attachShot(page, 'subtask-5-compact.png', '#dashTaskList');
    await page.reload();
    await page.waitForSelector('#openTaskDashBtn');
    await page.evaluate(() => { window.AppState = window.AppState || {}; if (!window.AppState.markersInitialized) window.AppState.markersInitialized = true; });
    await page.click('#openTaskDashBtn', { force: true });
    await expect(page.locator('#taskDashboard')).toHaveClass(/density-compact/);
  });

  test('Subtask 6: Team Panel Actionable', async ({ page }) => {
    const now = Date.now();
    await seedAgents(page, [{ id: 'tech-1', name: 'Tech A' }, { id: 'tech-2', name: 'Tech B' }]);
    await seedTasks(page, [{ id: 'TA1', priority: 'High', customer: 'Hotel Co', createdTime: now - 30 * 60 * 1000 }]);
    const taskCard = page.locator('.task-dashboard-card').first();
    const techCard = page.locator('.tech-grid-item').first();
    await taskCard.dragTo(techCard);
    await page.waitForTimeout(200);
    await expect(taskCard).toContainText(/Assigned/i);
    await attachShot(page, 'subtask-6-assignment.png', '.tech-grid-item');
  });

  test('Subtask 7: Technician Skills & Area Tags', async ({ page }) => {
    await seedAgents(page, [{ id: 'tech-1', name: 'Tech Skills', skills: ['Fiber', 'Wireless'], region: 'North' }]);
    const tech = page.locator('.tech-grid-item').first();
    await expect(tech).toContainText(/Fiber/);
    await expect(tech).toContainText(/North/);
    await attachShot(page, 'subtask-7-tags.png', '.tech-grid-item');
  });

  test('Subtask 8: Summary Metrics Interactive', async ({ page }) => {
    await seedTasks(page, [{ priority: 'Critical', customer: 'India Co' }]);
    await page.click('#hbOpenTickets');
    await expect(page.locator('#metricFilterChip')).toBeVisible();
    await attachShot(page, 'subtask-8-metric-chip.png', '#metricFilterChip');
    await page.click('#hbCriticalTasks');
    await expect(page.locator('#metricFilterChip')).toBeVisible();
  });

  test('Subtask 9: Metric Trend Indicators', async ({ page }) => {
    await seedTasks(page, [{ priority: 'Low', customer: 'Juliet Co' }]);
    const before = await page.locator('#hbOpenTicketsTrend');
    await expect(before).toBeVisible();
    await seedTasks(page, [{ priority: 'Low', customer: 'Kilo Co' }, { priority: 'High', customer: 'Lima Co' }]);
    await page.waitForTimeout(100);
    const trendText = await page.locator('#hbOpenTicketsTrend').innerText();
    expect(trendText).toMatch(/▲|▼|—/);
    await attachShot(page, 'subtask-9-trend.png', '.heartbeat-stat:nth-child(2)');
  });

  test('Subtask 10: Visual Language & Color Usage', async ({ page }) => {
    await seedTasks(page, [
      { id: 'VC1', priority: 'Critical', customer: 'Mike Co' },
      { id: 'VM1', priority: 'Medium', customer: 'November Co' }
    ]);
    const badges = page.locator('.task-dashboard-card .priority-badge');
    const critBadge = badges.nth(0);
    const otherBadge = badges.nth(1);
    await expect(critBadge).toHaveClass(/bg-red-600/);
    await expect(otherBadge).not.toHaveClass(/bg-red-600/);
    await attachShot(page, 'subtask-10-badges.png', '.task-dashboard-card');
  });

  test('Subtask 11: Empty & Error States', async ({ page }) => {
    const now = Date.now();
    await seedTasks(page, [{ priority: 'Medium', customer: 'Oscar Co', createdTime: now - 1 * 60 * 60 * 1000 }]);
    await page.selectOption('#dashTaskAgeFilter', '48h');
    await page.waitForTimeout(50);
    await expect(page.locator('#dashTaskList')).toContainText('No tasks match current filters');
    await expect(page.locator('#resetTaskFiltersBtn')).toBeVisible();
    await attachShot(page, 'subtask-11-empty.png', '#dashTaskList');
    await page.click('#resetTaskFiltersBtn');
    await expect(page.locator('.task-dashboard-card').first()).toBeVisible();
  });
});
