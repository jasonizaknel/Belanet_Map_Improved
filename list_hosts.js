require('dotenv').config();
const http = require('http');
const cheerio = require('cheerio');

const { NAGIOS_URL, NAGIOS_USER, NAGIOS_PASS } = process.env;
if (!NAGIOS_URL || !NAGIOS_USER || !NAGIOS_PASS) {
  console.error('Missing required env: NAGIOS_URL, NAGIOS_USER, NAGIOS_PASS');
  process.exit(1);
}

const auth = Buffer.from(`${NAGIOS_USER}:${NAGIOS_PASS}`).toString('base64');
const url = `${NAGIOS_URL}/cgi-bin/status.cgi?host=all&limit=0`;

const options = {
  headers: {
    Authorization: `Basic ${auth}`
  }
};

http.get(url, options, (res) => {
  let html = '';
  res.on('data', (chunk) => (html += chunk));
  res.on('end', () => {
    const $ = cheerio.load(html);
    const hosts = new Set();
    let currentHost = '';

    $('tr').each((i, row) => {
      const cells = $('td', row);
      if (cells.length < 3) return;

      const hostName = $(cells[0]).text().trim();
      if (hostName) currentHost = hostName;
      if (currentHost && currentHost.length < 100 && !currentHost.includes('Status')) hosts.add(currentHost);
    });

    console.log(Array.from(hosts).sort().join('\n'));
  });
}).on('error', console.error);
