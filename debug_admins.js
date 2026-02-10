require('dotenv').config();
const SPLYNX_URL = process.env.SPLYNX_URL || "https://splynx.bndns.co.za";
const SPLYNX_READ_ONLY_KEY = process.env.SPLYNX_READ_ONLY_KEY || process.env.SPLYNX_KEY || "";
const SPLYNX_SECRET = process.env.SPLYNX_SECRET || "";

async function fetchAdmins() {
    const auth = Buffer.from(`${SPLYNX_READ_ONLY_KEY}:${SPLYNX_SECRET}`).toString("base64");
    const url = `${SPLYNX_URL}/api/2.0/admin/administration/administrators`;
    
    console.log(`Fetching from: ${url}`);
    
    try {
        const response = await fetch(url, {
            headers: { 
                "Authorization": `Basic ${auth}`,
                "Accept": "application/json",
                "User-Agent": "PostmanRuntime/7.36.0"
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
