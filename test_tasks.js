const SPLYNX_URL = "https://splynx.bndns.co.za";
const SPLYNX_KEY = "6008a3ffd7c077e71bb964afeaf417e9";
const SPLYNX_SECRET = "81a29003872afafb19099ecfbf142838";

async function testTasks() {
    const auth = Buffer.from(`${SPLYNX_KEY}:${SPLYNX_SECRET}`).toString("base64");
    const url = `${SPLYNX_URL}/api/2.0/admin/scheduling/tasks`;
    
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
        // console.log(`Response: ${text}`);
        
        if (response.ok) {
            const tasks = JSON.parse(text);
            console.log(`Found ${tasks.length} tasks.`);
            return tasks;
        } else {
            console.log(`Error Response: ${text}`);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

testTasks();
