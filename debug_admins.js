require('dotenv').config();

const { SPLYNX_URL, SPLYNX_READ_ONLY_KEY, SPLYNX_KEY, SPLYNX_SECRET } = process.env;
const READ_KEY = SPLYNX_READ_ONLY_KEY || SPLYNX_KEY;

if (!SPLYNX_URL || !READ_KEY || !SPLYNX_SECRET) {
  console.error('Missing required env: SPLYNX_URL, SPLYNX_READ_ONLY_KEY (or SPLYNX_KEY), SPLYNX_SECRET');
  process.exit(1);
}

async function fetchAdmins() {
  const auth = Buffer.from(`${READ_KEY}:${SPLYNX_SECRET}`).toString('base64');
  const url = `${SPLYNX_URL}/api/2.0/admin/administration/administrators`;

  console.log(`Fetching from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'User-Agent': 'PostmanRuntime/7.36.0'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`Response: ${text}`);

    if (response.ok) {
      const admins = JSON.parse(text);
      console.log(`Found ${admins.length} admins.`);
      return admins;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

fetchAdmins();
