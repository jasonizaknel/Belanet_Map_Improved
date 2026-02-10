
const fs = require('fs');

const towers = JSON.parse(fs.readFileSync('Data/highsite.json', 'utf8'));
const serviceLogins = JSON.parse(fs.readFileSync('Data/servicelogin.json', 'utf8'));
const servicesId = JSON.parse(fs.readFileSync('Data/servicesId.json', 'utf8'));
const customers = JSON.parse(fs.readFileSync('Data/customers.json', 'utf8'));

const customerById = {};
customers.forEach(c => customerById[c.id] = c);

const serviceLoginToTower = {};
const unmatchedSites = new Set();

serviceLogins.forEach(login => {
    if (!login.id) return;
    
    const serviceSite = login.site;
    let matchingTower = towers.find(t => t.loginSite === serviceSite || t.site === serviceSite);
    
    if (!matchingTower && serviceSite) {
        const baseSite = serviceSite.split('.')[0].replace(/-Tower$/, '').replace(/-High-Site$/, '').replace(/ High Site$/, '').replace(/ HighSite$/, '').trim();
        matchingTower = towers.find(t => {
            const towerBase = t.id.trim();
            const towerSiteBase = t.site ? t.site.split('.')[0].replace(/-Tower$/, '').replace(/-High-Site$/, '').replace(/ High Site$/, '').replace(/ HighSite$/, '').trim() : '';
            return towerBase === baseSite || towerSiteBase === baseSite || t.id.includes(baseSite) || (t.site && t.site.includes(baseSite));
        });
    }

    if (matchingTower) {
        serviceLoginToTower[login.id] = matchingTower.id;
    } else {
        if (serviceSite) unmatchedSites.add(serviceSite);
    }
});

console.log("Unmatched Sites:");
unmatchedSites.forEach(site => console.log(`- ${site}`));

const customersWithNoLinks = [];
servicesId.forEach(service => {
    const customer = customerById[service.id];
    if (!customer) return;
    
    let hasLink = false;
    service.service_logins.forEach(loginId => {
        if (serviceLoginToTower[loginId]) {
            hasLink = true;
        }
    });
    
    if (!hasLink) {
        customersWithNoLinks.push({
            id: customer.id,
            name: customer.name,
            logins: service.service_logins.map(id => {
                const login = serviceLogins.find(l => l.id === id);
                return { id, site: login ? login.site : 'Unknown' };
            })
        });
    }
});

console.log("\nCustomers with NO links:");
customersWithNoLinks.slice(0, 20).forEach(c => {
    console.log(`${c.name} (ID: ${c.id})`);
    c.logins.forEach(l => console.log(`  - Login: ${l.id} | Site: ${l.site}`));
});
console.log(`\nTotal customers with no links: ${customersWithNoLinks.length}`);
