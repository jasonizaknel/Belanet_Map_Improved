const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    await page.goto('http://localhost:5505/map.html', { waitUntil: 'networkidle' });
    
    // Open the dashboard
    await page.click('#openTaskDashBtn');
    await page.waitForTimeout(2000); 
    
    await page.screenshot({ path: 'dashboard_check.png' });
    
    const hbOpenTickets = await page.innerText('#hbOpenTickets');
    console.log('Dashboard Open Tickets Metric:', hbOpenTickets);

  } catch (err) {
    console.error('Error during browser check:', err);
  } finally {
    await browser.close();
  }
})();
