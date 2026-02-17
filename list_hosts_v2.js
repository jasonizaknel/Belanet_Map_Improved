require('dotenv').config();
const http = require('http');
const cheerio = require('cheerio');
const fs = require('fs');

const { NAGIOS_URL, NAGIOS_USER, NAGIOS_PASS } = process.env;
if (!NAGIOS_URL || !NAGIOS_USER || !NAGIOS_PASS) {
  console.error('Missing required env: NAGIOS_URL, NAGIOS_USER, NAGIOS_PASS');
  process.exit(1);
}

async function listHosts() {
  const auth = Buffer.from(`${NAGIOS_USER}:${NAGIOS_PASS}`).toString('base64');
  const url = `${NAGIOS_URL}/cgi-bin/status.cgi?hostgroup=all&style=hostdetail&limit=0`;

  const options = {
    headers: { Authorization: `Basic ${auth}` }
  };

  http.get(url, options, (res) => {
    let html = '';
    res.on('data', (chunk) => (html += chunk));
    res.on('end', () => {
      const $ = cheerio.load(html);
      const hosts = new Set();
      $('tr').each((i, row) => {
        const cells = $('td', row);
        if (cells.length < 3) return;
        const hostName = $(cells[0]).text().trim();
        if (hostName && hostName !== 'Host' && hostName.length < 100) hosts.add(hostName);
      });
      const sortedHosts = Array.from(hosts).sort();
      fs.writeFileSync('nagios_hosts_new.txt', sortedHosts.join('\n'));
      console.log(`Saved ${sortedHosts.length} hosts to nagios_hosts_new.txt`);
    });
  });
}

listHosts();
