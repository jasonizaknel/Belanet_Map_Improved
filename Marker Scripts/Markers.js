
// =====================
// HELPERS
// =====================

function getTaskStatusLabel(task) {
    if (task.Status) return task.Status;
    if (task.status && isNaN(task.status)) return task.status;
    
    const statusId = parseInt(task.workflow_status_id || task.status);
    const statusMap = {
        1: "New",
        2: "In Progress",
        3: "Resolved",
        4: "Closed",
        5: "Rejected",
        6: "Waiting",
        7: "Planned",
        8: "Rescheduled"
    };
    
    return statusMap[statusId] || (statusId ? `Status ${statusId}` : "Unknown");
}

// =====================
// DATA LOADERS
// =====================

async function getTowers() {
    if (!AppState.towers) { 
        const res = await fetch("Data/highsite.json");
        AppState.towers = await res.json();
    }
    return AppState.towers;
}

// ADDED: Load configuration from server
async function getConfig() {
    if (!window.AppConfig) {
        try {
            const res = await fetch("/api/config");
            window.AppConfig = await res.json();
            console.log("Configuration loaded:", window.AppConfig);
        } catch (error) {
            console.error("Failed to load configuration:", error);
            window.AppConfig = {};
        }
    }
    return window.AppConfig;
}

async function getCustomers() {
    if (!AppState.customers) { 
        console.log("Fetching customers from Data/customers.json...");
        const res = await fetch("Data/customers.json");
        if (!res.ok) {
            console.error("Failed to fetch customers:", res.status, res.statusText);
            AppState.customers = [];
            return [];
        }
        AppState.customers = await res.json();
        console.log(`Loaded ${AppState.customers.length} customers`);
    }
    return AppState.customers;
}

async function fetchTasks() {
    const loadingBar = document.getElementById('tasksLoadingBar');
    if (loadingBar) loadingBar.classList.remove('hidden');
    
    try {
        const res = await fetch("/api/tasks");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        AppState.tasks = await res.json();
        console.log(`Tasks refreshed from Splynx API: ${AppState.tasks.length} tasks received`);
        mapTasksToCustomers();
        renderGlobalTasksList();
        return AppState.tasks;
    } catch (error) {
        console.error("Failed to fetch tasks from API, falling back to local file:", error.message);
        const res = await fetch("Data/tasks.json");
        AppState.tasks = await res.json();
        mapTasksToCustomers();
        renderGlobalTasksList();
        return AppState.tasks;
    } finally {
        if (loadingBar) loadingBar.classList.add('hidden');
    }
}

async function getTasks() {
    if (!AppState.tasks) { 
        await fetchTasks();
    }
    return AppState.tasks;
}

// ADDED: Load service login data
async function getServiceLogins() {
    if (!AppState.serviceLogins) {
        const res = await fetch("Data/servicelogin.json");
        AppState.serviceLogins = await res.json();
    }
    return AppState.serviceLogins;
}

// ADDED: Load tracker positions from server
async function getTrackerPositions() {
    if (!AppState.trackerPositions) {
        try {
            console.log("Fetching tracker positions from /api/positions...");
            const res = await fetch("/api/positions");
            console.log("Fetch response received, status:", res.status);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            AppState.trackerPositions = await res.json();
            console.log("Tracker positions loaded:", AppState.trackerPositions);
        } catch (error) {
            console.error("Failed to load tracker positions:", error.message);
            AppState.trackerPositions = [];
        }
    }
    return AppState.trackerPositions;
}

// ADDED: Load service IDs and create links
async function loadServiceLinks() {
    const res = await fetch("Data/servicesId.json");
    const servicesData = await res.json();
    
    // ADDED: Track skipped entries for logging
    const skippedEntries = [];
    
    // FIXED: Create map of service login ID to tower ID by matching site names
    const serviceLoginToTower = {};
    AppState.serviceLogins.forEach(login => {
        // ADDED: Skip entries without valid ID
        if (!login.id) {
            skippedEntries.push(`Service login entry: ${login.site || 'Unknown'} (missing id)`);
            return;
        }
        
        // FIXED: Match by loginSite, site name OR by id variations
        const serviceSite = login.site;
        let matchingTower = AppState.towers.find(t => t.loginSite === serviceSite || t.site === serviceSite);
        
        if (!matchingTower && serviceSite) {
            // Try matching base name if "High Site" or "Tower" suffix is different
            const baseSite = serviceSite.split('.')[0].replace(/-Tower$/, '').replace(/-High-Site$/, '').replace(/ High Site$/, '').replace(/ HighSite$/, '').trim();
            matchingTower = AppState.towers.find(t => {
                const towerBase = t.id.trim();
                const towerSiteBase = t.site ? t.site.split('.')[0].replace(/-Tower$/, '').replace(/-High-Site$/, '').replace(/ High Site$/, '').replace(/ HighSite$/, '').trim() : '';
                return towerBase === baseSite || towerSiteBase === baseSite || t.id.includes(baseSite) || (t.site && t.site.includes(baseSite));
            });
        }

        if (matchingTower) {
            serviceLoginToTower[login.id] = matchingTower.id;
        }
    });
    
    // ADDED: Create links between customers and towers
    servicesData.forEach(service => {
        const customer = AppState.customerById[String(service.id)];
        if (!customer) return;
        
        service.service_logins.forEach(serviceLogin => {
            // FIXED: Use corrected mapping
            const towerId = serviceLoginToTower[serviceLogin];
            if (towerId) {
                AppState.serviceLinks.push({
                    customerId: service.id,
                    towerId: towerId,
                    serviceLogin: serviceLogin
                });
                // ADDED: Mark customer as having a link
                customer.hasLink = true;
            }
        });
    });
    
    // ADDED: Log skipped entries to console
    if (skippedEntries.length > 0) {
        console.warn('⚠ Skipped service login entries:');
        skippedEntries.forEach(entry => console.warn(`  - ${entry}`));
    }
}


// =====================
// DATA INITIALIZATION
// =====================



async function fetchWeatherData() {
    try {
        const response = await fetch('/api/weather');
        
        if (!response.ok) {
            console.warn('[Weather] Failed to fetch weather data:', response.status);
            return;
        }
        
        const data = await response.json();
        AppState.weatherData.current = data.current;
        AppState.weatherData.forecast = data.forecast;
        AppState.weatherData.lastUpdate = data.lastUpdate;
        
        console.log('[Weather] Successfully fetched weather data:', data.current);
    } catch (error) {
        console.error('[Weather] Error fetching weather data:', error);
    }
}

function startWeatherRefresh() {
    if (AppState.weatherRefresh.timer) {
        return;
    }
    
    console.log('[Weather] Starting weather data refresh');
    fetchWeatherData();
    
    AppState.weatherRefresh.timer = setInterval(() => {
        if (AppState.visibility.weather) {
            fetchWeatherData();
        }
    }, AppState.weatherRefresh.interval);
}

function stopWeatherRefresh() {
    if (AppState.weatherRefresh.timer) {
        console.log('[Weather] Stopping weather data refresh');
        clearInterval(AppState.weatherRefresh.timer);
        AppState.weatherRefresh.timer = null;
    }
}

async function loadData() { 
    console.log("loadData() starting...");
    AppState.customerById = {};
    
    // ADDED: Load config before other data
    await getConfig();
    
    AppState.towers = await getTowers();
    AppState.customers = await getCustomers(); 
    AppState.tasks = await getTasks(); 
    // ADDED: Load service logins before creating service links
    await getServiceLogins();
    // ADDED: Load tracker positions from server
    console.log("About to call getTrackerPositions()...");
    await getTrackerPositions();
    console.log("getTrackerPositions() completed, trackerPositions:", AppState.trackerPositions);

    const customerByName = {};
    AppState.customers.forEach(cust => {
        AppState.customerById[String(cust.id)] = cust;
        customerByName[cust.name] = cust;
    });

    mapTasksToCustomers();
    renderGlobalTasksList();

    // ADDED: Load service links after customer data is ready
    await loadServiceLinks();

    AppState.dataLoaded = true;
    if (AppState.map) renderMarkers(); // CHANGED: only render when map exists
}


// =====================
// MAP INITIALIZATION
// =====================

window.initMap = function () { // CHANGED: must be global for Google callback
    AppState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: -25.0, lng: 28.0 },
        zoom: 8
    });

    // ADDED: Initialize simulation UI once map is ready
    if (typeof initSimulationUI === 'function') {
        initSimulationUI();
    }

    // ADDED: Initialize weather layers if active
    updateWeatherLayers();

    if (AppState.visibility && AppState.visibility.weather) {
        const cfg = window.AppConfig || {};
        const key = cfg.openWeatherKey;
        if (key && typeof WeatherOverlay !== 'undefined' && typeof WeatherService !== 'undefined' && typeof ClockManager !== 'undefined') {
            const c = AppState.map ? AppState.map.getCenter() : null;
            const lat = c ? c.lat() : -25.0;
            const lon = c ? c.lng() : 28.0;
            if (window.__WeatherOverlay && window.__WeatherOverlay._root) {
                window.__WeatherOverlay._root.style.display = '';
            } else {
                const svc = new WeatherService({ apiKey: key, ttl: { current: 300000, hourly: 600000, daily: 3600000 } });
                const clk = new ClockManager();
                const ov = new WeatherOverlay({ service: svc, clock: clk, lat, lon, id: 'map' });
                ov.mount(document.body);
                window.__WeatherOverlay = ov;
            }
        }
        startWeatherRefresh();
    } else {
        if (window.__WeatherOverlay && typeof window.__WeatherOverlay.destroy === 'function') {
            window.__WeatherOverlay.destroy();
            window.__WeatherOverlay = null;
        }
        stopWeatherRefresh();
    }

    const wb = document.getElementById('toggleWeatherBtn');
    if (wb) wb.classList.toggle('active', !!(AppState.visibility && AppState.visibility.weather));

    if (AppState.dataLoaded) renderMarkers(); // CHANGED: render if data already loaded
};


// =====================
// MARKER RENDERING
// =====================

// ADDED: Animate polyline weight and opacity with smooth transition
function animatePolyline(polyline, startWeight, startOpacity, endWeight, endOpacity, duration) {
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // ADDED: Linear interpolation for smooth transition
        const currentWeight = startWeight + (endWeight - startWeight) * progress;
        const currentOpacity = startOpacity + (endOpacity - startOpacity) * progress;
        
        polyline.setOptions({
            strokeWeight: currentWeight,
            strokeOpacity: currentOpacity
        });
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    
    requestAnimationFrame(animate);
}

// ADDED: Get SVG icon for customer based on "anger" level (tasks)
function getCustomerIcon(customer) {
    const taskCount = customer.tasks ? customer.tasks.length : 0;
    
    // Check if linked tower is down (UI bug fix)
    let towerIsDown = false;
    if (AppState.customerTowerCache && AppState.customerTowerCache[customer.id]) {
        const linkedTowers = AppState.customerTowerCache[customer.id];
        towerIsDown = linkedTowers.some(towerId => {
            const color = getTowerStatusColor(towerId);
            return color === "#d32f2f"; // Red = Critical/Down
        });
    }

    // Determine color based on task count, age, or tower status
    let color = "#4CAF50"; // Green (0 tasks)
    let expression = "M 10,13 Q 12,13 14,13"; // Neutral mouth
    
    // Check for "Legacy" tasks (oldest task > 30 days)
    let isLegacy = false;
    if (customer.tasks && customer.tasks.length > 0) {
        const now = Date.now();
        isLegacy = customer.tasks.some(t => {
            const createdAt = new Date(t.date_created || t.created_at || now).getTime();
            return (now - createdAt) / (1000 * 3600 * 24) > 30;
        });
    }

    if (towerIsDown) {
        color = "#000000"; // Black icon if tower is down
        expression = "M 8,17 Q 12,12 16,17"; // Angry frown
    } else if (isLegacy) {
        color = "#9c27b0"; // Purple for Legacy (Long-standing)
        expression = "M 10,14 Q 12,14 14,14"; // Patient expression
    } else if (taskCount > 0 && taskCount <= 1) {
        color = "#FFEB3B"; // Yellow
        expression = "M 10,14 Q 12,14 14,14"; // Flat mouth
    } else if (taskCount > 1 && taskCount <= 3) {
        color = "#FF9800"; // Orange
        expression = "M 10,15 Q 12,14 14,15"; // Slight frown
    } else if (taskCount > 3 && taskCount <= 5) {
        color = "#f44336"; // Red
        expression = "M 9,16 Q 12,13 15,16"; // Frown
    } else if (taskCount > 5) {
        color = "#b71c1c"; // Deep Red
        expression = "M 8,17 Q 12,12 16,17"; // Angry frown
    }

    // Simple "little man" SVG
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <!-- Head -->
            <circle cx="12" cy="7" r="5" fill="${color}" stroke="#333" stroke-width="1"/>
            <!-- Body -->
            <path d="M12,12 Q12,22 12,22 M12,15 L7,12 M12,15 L17,12 M12,22 L8,24 M12,22 L16,24" stroke="#333" stroke-width="2" fill="none"/>
            <!-- Face features -->
            <circle cx="10" cy="6" r="0.8" fill="#333"/>
            <circle cx="14" cy="6" r="0.8" fill="#333"/>
            <path d="${expression}" stroke="#333" stroke-width="1" fill="none"/>
        </svg>
    `;
    
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(24, 24),
        anchor: new google.maps.Point(12, 12)
    };
}

// ADDED: Strike marker class for lightning events
class StrikeMarker {
    constructor(strike) {
        this.strike = strike;
        this.opacity = 1.0;
        this.marker = new google.maps.Marker({
            position: { lat: strike.lat, lng: strike.lng },
            map: AppState.visibility.weather ? AppState.map : null,
            icon: this.getIcon(),
            optimized: false,
            zIndex: 1000
        });

        // Auto-fade and remove
        this.fadeInterval = setInterval(() => {
            this.opacity -= 0.05;
            if (this.opacity <= 0) {
                this.remove();
            } else {
                this.marker.setOpacity(this.opacity);
            }
        }, 100);
    }

    getIcon() {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#FFD700"/>
            </svg>
        `;
        return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        };
    }

    remove() {
        clearInterval(this.fadeInterval);
        this.marker.setMap(null);
        const index = AppState.strikeMarkers.indexOf(this);
        if (index > -1) {
            AppState.strikeMarkers.splice(index, 1);
        }
    }
}

// ADDED: Update weather tile layers
function updateWeatherLayers() {
    const apiKey = window.AppConfig ? window.AppConfig.openWeatherKey : null;
    if (!AppState.map || !google || !google.maps) return;

    // Supported Weather Maps 1.0 layers
    const supportedLayers = [
        'clouds_new',
        'precipitation_new',
        'rain_new',
        'snow_new',
        'temp_new',
        'wind_new',
        'pressure_new'
    ];

    // Default visible layers
    const defaultLayers = ['clouds_new', 'precipitation_new', 'temp_new'];

    // Clear existing weather layers safely from overlayMapTypes (MVCArray)
    for (const key of Object.keys(AppState.weatherLayers)) {
        const overlay = AppState.weatherLayers[key];
        if (!overlay) continue;
        const overlays = AppState.map.overlayMapTypes;
        for (let i = overlays.getLength() - 1; i >= 0; i--) {
            if (overlays.getAt(i) === overlay) {
                overlays.removeAt(i);
            }
        }
        delete AppState.weatherLayers[key];
    }

    if (!AppState.visibility.weather || !apiKey) return;

    if (AppState.weatherData.current) {
        console.log('[Weather] Current conditions:', {
            temp: AppState.weatherData.current.temp + '°C',
            weather: AppState.weatherData.current.weather,
            description: AppState.weatherData.current.description
        });
    }

    // Create ImageMapTypes for supported layers (store but only add defaults)
    const layerMeta = {
        'clouds_new': { name: 'Clouds', opacity: 0.55 },
        'precipitation_new': { name: 'Precipitation', opacity: 0.6 },
        'rain_new': { name: 'Rain', opacity: 0.6 },
        'snow_new': { name: 'Snow', opacity: 0.6 },
        'temp_new': { name: 'Temperature', opacity: 0.4 },
        'wind_new': { name: 'Wind', opacity: 0.5 },
        'pressure_new': { name: 'Pressure', opacity: 0.5 }
    };

    supportedLayers.forEach((type) => {
        const meta = layerMeta[type] || { name: type, opacity: 0.6 };
        const imageMapType = new google.maps.ImageMapType({
            getTileUrl: function(coord, zoom) {
                return `https://tile.openweathermap.org/map/${type}/${zoom}/${coord.x}/${coord.y}.png?appid=${apiKey}`;
            },
            tileSize: new google.maps.Size(256, 256),
            name: meta.name,
            opacity: meta.opacity
        });
        AppState.weatherLayers[type] = imageMapType;
    });

    // Push default layers in defined order
    defaultLayers.forEach((type) => {
        const overlay = AppState.weatherLayers[type];
        if (overlay) AppState.map.overlayMapTypes.push(overlay);
    });
}

// ADDED: Animate polyline drawing from start to end
function animateDrawing(polyline, startPos, endPos, duration = 1000) {
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Linear interpolation for coordinates
        const lat = startPos.lat() + (endPos.lat() - startPos.lat()) * progress;
        const lng = startPos.lng() + (endPos.lng() - startPos.lng()) * progress;
        
        const currentPos = new google.maps.LatLng(lat, lng);
        polyline.setPath([startPos, currentPos]);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Ensure final path is exact
            polyline.setPath([startPos, endPos]);
        }
    };
    
    requestAnimationFrame(animate);
}

// ADDED: Render tracker markers from server
function renderTrackerMarkers() {
    // FIXED: Initialize storage if needed
    AppState.trackerMarkers = AppState.trackerMarkers || [];

    if (!AppState.trackerPositions || AppState.trackerPositions.length === 0) {
        console.log("No tracker positions to render");
        AppState.trackerMarkers.forEach(t => t.marker.setMap(null));
        return;
    }

    console.log(`Rendering ${AppState.trackerPositions.length} tracker markers, visibility: ${AppState.visibility.trackers}`);

    // Track which markers we still need
    const activeDeviceIds = new Set(AppState.trackerPositions.map(p => p.deviceId));
    
    // Remove markers for devices no longer in the list
    for (let i = AppState.trackerMarkers.length - 1; i >= 0; i--) {
        if (!activeDeviceIds.has(AppState.trackerMarkers[i].position.deviceId)) {
            AppState.trackerMarkers[i].marker.setMap(null);
            AppState.trackerMarkers.splice(i, 1);
        }
    }

    AppState.trackerPositions.forEach(position => {
        const deviceName = position.attributes?.name || `Device ${position.deviceId}`;
        const existingMarkerData = AppState.trackerMarkers.find(m => m.position.deviceId === position.deviceId);

        if (existingMarkerData) {
            // Update existing marker position
            existingMarkerData.marker.setPosition({ lat: position.latitude, lng: position.longitude });
            existingMarkerData.marker.setMap(AppState.visibility.trackers ? AppState.map : null);
            existingMarkerData.position = position;
            
            // ADDED: Update info window content with fresh data
            if (existingMarkerData.infoWindow) {
                existingMarkerData.infoWindow.setContent(`
                    <div style="font-size: 14px;">
                        <strong>${deviceName}</strong><br>
                        Lat: ${position.latitude.toFixed(4)}<br>
                        Lng: ${position.longitude.toFixed(4)}<br>
                        Speed: ${position.speed || 0} km/h<br>
                        Timestamp: ${new Date(position.fixTime).toLocaleString()}
                    </div>
                `);
            }
        } else {
            // Create new marker
            const icon = {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: "#2196F3",
                scale: 8,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            };

            const marker = new google.maps.Marker({
                position: { lat: position.latitude, lng: position.longitude },
                map: AppState.visibility.trackers ? AppState.map : null,
                title: deviceName,
                icon: icon
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="font-size: 14px;">
                        <strong>${deviceName}</strong><br>
                        Lat: ${position.latitude.toFixed(4)}<br>
                        Lng: ${position.longitude.toFixed(4)}<br>
                        Speed: ${position.speed || 0} km/h<br>
                        Timestamp: ${new Date(position.fixTime).toLocaleString()}
                    </div>
                `
            });

            marker.addListener("click", () => {
                infoWindow.open(AppState.map, marker);
            });

            // ADDED: Store infoWindow reference so it can be updated later
            AppState.trackerMarkers.push({ marker, position, deviceName, infoWindow });
        }
    });
}

// ADDED: Connect to WebSocket for real-time tracker updates
function connectTrackerWebSocket() {
    if (AppState.trackerRefresh.ws) {
        return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
        AppState.trackerRefresh.ws = new WebSocket(wsUrl);

        AppState.trackerRefresh.ws.addEventListener("open", () => {
            console.log("[WebSocket] Connected to tracker server");
            AppState.trackerRefresh.wsConnected = true;
            AppState.trackerRefresh.useFallback = false;
        });

        AppState.trackerRefresh.ws.addEventListener("message", (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "tracker_update") {
                    AppState.trackerPositions = data.positions;
                    renderTrackerMarkers();
                    console.log(`[WebSocket] Updated ${data.positions.length} trackers at ${new Date().toLocaleTimeString()}`);
                } else if (data.type === "nagios_update") {
                    // ADDED: Process Nagios service status updates
                    processNagiosStatus(data.services);
                    console.log(`[WebSocket] Updated Nagios status for ${data.services.length} services`);
                } else if (data.type === "tasks_update") {
                    AppState.tasks = data.tasks;
                    console.log(`[WebSocket] Updated ${data.tasks.length} tasks`);
                    
                    // ADDED: Re-map tasks and update UI
                    mapTasksToCustomers();
                    renderGlobalTasksList();
                    updateCustomerMarkerVisibility();
                    
                    // If TeamSidebar detail view is open, refresh it
                    if (window.AppState.team.activeMemberId && typeof updateMemberStats === 'function') {
                        const member = window.AppState.team.members.find(m => m.id === window.AppState.team.activeMemberId);
                        if (member) updateMemberStats(member);
                    }
                } else if (data.type === "weather_update") {
                    // ADDED: Process lightning strike events
                    if (data.strikes && Array.isArray(data.strikes)) {
                        data.strikes.forEach(strike => {
                            AppState.strikeMarkers.push(new StrikeMarker(strike));
                        });
                        console.log(`[WebSocket] Received ${data.strikes.length} lightning strikes`);
                    }
                } else if (data.type === "welcome") {
                    console.log("[WebSocket]", data.message);
                }
            } catch (error) {
                console.error("[WebSocket] Error parsing message:", error.message);
            }
        });

        AppState.trackerRefresh.ws.addEventListener("close", () => {
            console.log("[WebSocket] Disconnected, falling back to polling");
            AppState.trackerRefresh.wsConnected = false;
            AppState.trackerRefresh.ws = null;
            AppState.trackerRefresh.useFallback = true;
            startTrackerRefreshLoop();
        });

        AppState.trackerRefresh.ws.addEventListener("error", (error) => {
            console.error("[WebSocket] Connection error:", error);
            AppState.trackerRefresh.useFallback = true;
        });
    } catch (error) {
        console.error("[WebSocket] Failed to connect:", error.message);
        AppState.trackerRefresh.useFallback = true;
        startTrackerRefreshLoop();
    }
}

// ADDED: Start periodic tracker position updates (fallback for when WebSocket unavailable)
function startTrackerRefreshLoop() {
    if (AppState.trackerRefresh.timer) {
        clearInterval(AppState.trackerRefresh.timer);
    }

    if (!AppState.trackerRefresh.enabled) {
        console.log("Tracker auto-refresh disabled");
        return;
    }

    // Skip polling if WebSocket is connected
    if (AppState.trackerRefresh.wsConnected && !AppState.trackerRefresh.useFallback) {
        console.log("WebSocket connected, skipping polling");
        return;
    }

    console.log(`Starting tracker refresh loop - fallback polling (interval: ${AppState.trackerRefresh.interval}ms)`);
    
    AppState.trackerRefresh.timer = setInterval(async () => {
        try {
            // Only fetch and update tracker positions, not other data
            AppState.trackerPositions = null;
            await getTrackerPositions();
            renderTrackerMarkers();
            console.log("[Polling] Trackers updated:", new Date().toLocaleTimeString());
        } catch (error) {
            console.error("Error updating trackers:", error.message);
        }
    }, AppState.trackerRefresh.interval);
}

// ADDED: Stop tracker refresh loop
function stopTrackerRefreshLoop() {
    if (AppState.trackerRefresh.timer) {
        clearInterval(AppState.trackerRefresh.timer);
        AppState.trackerRefresh.timer = null;
        console.log("Tracker polling stopped");
    }

    if (AppState.trackerRefresh.ws) {
        AppState.trackerRefresh.ws.close();
        AppState.trackerRefresh.ws = null;
        AppState.trackerRefresh.wsConnected = false;
        console.log("WebSocket disconnected");
    }
}

// ADDED: Initialize tracker refresh controls
function initTrackerRefreshControls() {
    const checkbox = document.getElementById("trackerAutoRefreshCheckbox");
    const intervalInput = document.getElementById("trackerRefreshInterval");

    if (!checkbox || !intervalInput) return;

    checkbox.addEventListener("change", (e) => {
        AppState.trackerRefresh.enabled = e.target.checked;
        if (AppState.trackerRefresh.enabled) {
            startTrackerRefreshLoop();
        } else {
            stopTrackerRefreshLoop();
        }
    });

    intervalInput.addEventListener("change", (e) => {
        const newInterval = Math.max(1, parseInt(e.target.value) * 1000);
        AppState.trackerRefresh.interval = newInterval;
        console.log(`Tracker refresh interval updated to ${newInterval}ms`);
        
        // Restart the loop with new interval
        if (AppState.trackerRefresh.enabled) {
            startTrackerRefreshLoop();
        }
    });
}

// ADDED: Render service link polylines between customers and towers
function renderServiceLinks(animate = false) {
    // ADDED: Clear existing polylines
    AppState.polylines.forEach(p => p.polyline.setMap(null));
    AppState.polylines.length = 0;

    AppState.serviceLinks.forEach(link => {
        const customerMarkerData = AppState.customerMarkers.find(m => m.customer.id === link.customerId);
        const towerMarkerData = AppState.towerMarkers.find(t => t.tower.id === link.towerId);

        if (!customerMarkerData || !towerMarkerData) return;

        // ADDED: Check if tower is selected in filter and customer is visible
        const isFilterActive = AppState.filters.selectedTowers.length > 0;
        const isTowerSelected = AppState.filters.selectedTowers.includes(link.towerId);
        const isCustomerVisible = customerMarkerData.marker.getMap() !== null;
        const shouldShowLink = (!isFilterActive || isTowerSelected) && isCustomerVisible;

        if (!shouldShowLink || !AppState.visibility.links) return;

        // CHANGED: Use marker position directly
        const startPos = customerMarkerData.marker.getPosition();
        const endPos = towerMarkerData.marker.getPosition();

        // ADDED: Create polyline between customer and tower
        const polyline = new google.maps.Polyline({
            path: animate ? [startPos, startPos] : [startPos, endPos],
            map: AppState.map,
            strokeColor: "#FF9800",
            strokeOpacity: 0.7,
            strokeWeight: 2,
            geodesic: true
        });

        if (animate) {
            animateDrawing(polyline, startPos, endPos);
        }

        // ADDED: Store polyline with metadata
        const polylineData = { polyline, link };
        AppState.polylines.push(polylineData);

        // ADDED: Hover effect with smooth transition animation
        let animationFrameId = null;
        
        polyline.addListener("mouseover", () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animatePolyline(polyline, 2, 0.7, 4, 1, 200);
        });

        polyline.addListener("mouseout", () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animatePolyline(polyline, 4, 1, 2, 0.7, 200);
        });
    });
}

// ADDED: Process Nagios service status and organize by tower
function processNagiosStatus(services) {
    AppState.nagiosStatus = {};
    
    services.forEach(service => {
        const hostName = service.host_name;
        
        if (!AppState.nagiosStatus[hostName]) {
            AppState.nagiosStatus[hostName] = {
                hostName: hostName,
                services: [],
                overallStatus: "OK",
                criticalCount: 0,
                warningCount: 0,
                unknownCount: 0
            };
        }
        
        const status = {
            name: service.service_name,
            state: service.current_state,
            stateText: service.current_state_text,
            pluginOutput: service.plugin_output,
            lastCheck: service.last_check,
            nextCheck: service.next_check
        };
        
        AppState.nagiosStatus[hostName].services.push(status);
        
        // Track counts (0=OK/UP, 1=WARNING/UNREACHABLE, 2=CRITICAL/DOWN, 3=UNKNOWN)
        if (service.current_state === 2 || service.current_state_text === 'DOWN') {
            AppState.nagiosStatus[hostName].criticalCount++;
            AppState.nagiosStatus[hostName].overallStatus = "CRITICAL";
        } else if ((service.current_state === 1 || service.current_state_text === 'WARNING' || service.current_state_text === 'UNREACHABLE') && AppState.nagiosStatus[hostName].overallStatus !== "CRITICAL") {
            AppState.nagiosStatus[hostName].warningCount++;
            AppState.nagiosStatus[hostName].overallStatus = "WARNING";
        } else if (service.current_state === 0 || service.current_state_text === 'OK' || service.current_state_text === 'UP') {
            if (AppState.nagiosStatus[hostName].overallStatus !== "CRITICAL" && AppState.nagiosStatus[hostName].overallStatus !== "WARNING") {
                AppState.nagiosStatus[hostName].overallStatus = service.current_state_text === 'UP' ? 'UP' : 'OK';
            }
        } else if (service.current_state === 3) {
            AppState.nagiosStatus[hostName].unknownCount++;
        }
    });
    
    // Re-render towers with updated Nagios status
    if (typeof renderTowers === 'function' && AppState.towers) {
        renderTowers();
    }
}

// ADDED: Get tower status color based on Nagios data
function getTowerStatusColor(towerId) {
    // Check for simulated outages first
    if (AppState.simulation.active && AppState.simulation.outages.includes(towerId)) {
        return "#d32f2f"; // Red
    }

    const tower = AppState.towers.find(t => t.id === towerId);
    if (!tower) return "#FF6F00"; // Default orange
    
    // Create a list of possible Nagios host names to check
    const hostNames = new Set();
    
    // Add variations for ID
    hostNames.add(tower.id);
    hostNames.add(tower.id.replace(/\s+/g, ''));
    hostNames.add(tower.id.replace(/\s+/g, '-'));
    hostNames.add(`${tower.id}-Tower.belanet.co.za`);
    hostNames.add(`${tower.id.replace(/\s+/g, '')}-Tower.belanet.co.za`);
    hostNames.add(`${tower.id.replace(/\s+/g, '-')}-Tower.belanet.co.za`);
    
    // Add variations for Site (if exists)
    if (tower.site) {
        hostNames.add(tower.site);
        hostNames.add(tower.site.replace(/\s+/g, ''));
        hostNames.add(tower.site.replace(/\s+/g, '-'));
        hostNames.add(`${tower.site}-Tower.belanet.co.za`);
        hostNames.add(`${tower.site.replace(/\s+/g, '')}-Tower.belanet.co.za`);
        hostNames.add(`${tower.site.replace(/\s+/g, '-')}-Tower.belanet.co.za`);
    }
    
    for (const hostName of hostNames) {
        const nagiosData = AppState.nagiosStatus[hostName];
        if (nagiosData) {
            if (nagiosData.overallStatus === "CRITICAL" || nagiosData.overallStatus === "DOWN") return "#d32f2f"; // Red
            if (nagiosData.overallStatus === "WARNING" || nagiosData.overallStatus === "UNREACHABLE") return "#f57c00"; // Orange
            if (nagiosData.overallStatus === "OK" || nagiosData.overallStatus === "UP") return "#388e3c"; // Green
            if (nagiosData.overallStatus === "UNKNOWN") return "#757575"; // Gray
        }
    }
    
    return "#FF6F00"; // Default orange if no Nagios data
}

// ADDED: Get sector status details for info window
function getTowerSectorStatus(towerId) {
    const tower = AppState.towers.find(t => t.id === towerId);
    if (!tower) return [];
    
    // Create prefixes to look for sectors
    const prefixes = new Set();
    const addPrefix = (name) => {
        if (!name) return;
        // Remove common suffixes to get base name
        const base = name.split('.')[0].replace(/-Tower$/, '').replace(/-High-Site$/, '').replace(/ High Site$/, '');
        prefixes.add(base);
    };

    addPrefix(tower.id);
    addPrefix(tower.site);
    
    const sectorStatuses = [];
    const seenSectors = new Set();

    Object.keys(AppState.nagiosStatus).forEach(hostName => {
        // Look for names that match [Prefix]-(Sector|Sec|Sec)[Number]
        for (const prefix of prefixes) {
            const pattern = new RegExp(`^${prefix}-(Sector|Sec|Sec)\\d+`, 'i');
            if (pattern.test(hostName) && !seenSectors.has(hostName)) {
                const status = AppState.nagiosStatus[hostName];
                sectorStatuses.push({
                    name: hostName,
                    status: status.overallStatus,
                    services: status.services.length
                });
                seenSectors.add(hostName);
                break;
            }
        }
    });
    
    return sectorStatuses.sort((a, b) => a.name.localeCompare(b.name));
}

// ADDED: Get animated SVG icon for towers
function getTowerSvg(color) {
    // Helper to lighten color for pulse effect
    const lightenColor = (col) => {
        const colors = {
            "#2196F3": "#64B5F6", // Blue
            "#d32f2f": "#ef5350", // Red
            "#f57c00": "#ffb74d", // Orange
            "#388e3c": "#66bb6a", // Green
            "#757575": "#bdbdbd", // Gray
            "#FF6F00": "#FFB74D"  // Deep Orange
        };
        return colors[col] || "#FFB74D";
    };
    const lightColor = lightenColor(color);
    
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <!-- Pulsing outer ring -->
            <circle cx="16" cy="16" r="4" fill="${color}" opacity="0.6">
                <animate attributeName="r" from="4" to="14" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
            <!-- Tower base -->
            <path d="M16,4 L8,28 L24,28 Z" fill="#444" stroke="#fff" stroke-width="1"/>
            <!-- Tower top indicator -->
            <circle cx="16" cy="4" r="4" fill="${color}" stroke="#fff" stroke-width="1"/>
        </svg>
    `;
}

// ADDED: Render tower markers
function renderTowers() {
    // ADDED: Clear existing tower markers
    AppState.towerMarkers.forEach(t => t.marker.setMap(null));
    AppState.towerMarkers.length = 0;

    // ADDED: Create set of tower IDs that have links
    const towersWithLinks = new Set(AppState.serviceLinks.map(link => link.towerId));

    AppState.towers.forEach(tower => {
        // ADDED: Check if tower has any associated links
        const hasLink = towersWithLinks.has(tower.id);
        
        // ADDED: Check if tower should be visible based on filters
        const isTowerSelected = AppState.filters.selectedTowers.length === 0 || AppState.filters.selectedTowers.includes(tower.id);
        const shouldHideUnlinked = AppState.filters.hideUnlinkedTowers && !hasLink;
        const shouldShowTower = isTowerSelected && !shouldHideUnlinked;

        // FIXED: Use animated SVG for ALL towers with status-based colors
        const statusColor = hasLink ? "#2196F3" : getTowerStatusColor(tower.id);
        const towerSvg = getTowerSvg(statusColor);
        
        const icon = {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(towerSvg),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        };

        const marker = new google.maps.Marker({
            position: { lat: tower.lat, lng: tower.lng },
            map: (AppState.visibility.towers && shouldShowTower) ? AppState.map : null,
            title: tower.id,
            icon: icon,
            // ADDED: Nice drop animation when towers appear
            animation: google.maps.Animation.DROP
        });

        // ADDED: Create info window with sector status details
        const sectorStatuses = getTowerSectorStatus(tower.id);
        
        // ADDED: Get Host Status if available
        let hostStatusHtml = '';
        const hostVariations = [tower.id, tower.site, `${tower.id}-Tower.belanet.co.za`, `${tower.site}`];
        for (const h of hostVariations) {
            if (h && AppState.nagiosStatus[h]) {
                const status = AppState.nagiosStatus[h];
                const color = status.overallStatus === 'OK' || status.overallStatus === 'UP' ? '#388e3c' : status.overallStatus === 'CRITICAL' || status.overallStatus === 'DOWN' ? '#d32f2f' : '#f57c00';
                hostStatusHtml = `<div style="margin-bottom: 5px;"><strong>Host Status:</strong> <span style="color: ${color}; font-weight: bold;">${status.overallStatus}</span></div>`;
                break;
            }
        }

        let sectorHtml = '';
        if (sectorStatuses.length > 0) {
            sectorHtml = '<strong>Sectors:</strong><ul style="margin: 5px 0; padding-left: 15px;">';
            sectorStatuses.forEach(sector => {
                const statusColor = sector.status === 'OK' || sector.status === 'UP' ? '#388e3c' : sector.status === 'CRITICAL' || sector.status === 'DOWN' ? '#d32f2f' : '#f57c00';
                sectorHtml += `<li><span style="color: ${statusColor}; font-weight: bold;">${sector.name}</span> (${sector.status})</li>`;
            });
            sectorHtml += '</ul>';
        }

        const infoWindow = new google.maps.InfoWindow();
        
        marker.addListener("click", () => {
            // RE-CALCULATE content on click to ensure Nagios status is fresh
            const hasLink = towersWithLinks.has(tower.id);
            const sectorStatuses = getTowerSectorStatus(tower.id);
            
            let hostStatusHtml = '';
            const hostVariations = [tower.id, tower.site, `${tower.id}-Tower.belanet.co.za`, `${tower.site}`];
            for (const h of hostVariations) {
                if (h && AppState.nagiosStatus[h]) {
                    const status = AppState.nagiosStatus[h];
                    const color = status.overallStatus === 'OK' || status.overallStatus === 'UP' ? '#388e3c' : status.overallStatus === 'CRITICAL' || status.overallStatus === 'DOWN' ? '#d32f2f' : '#f57c00';
                    hostStatusHtml = `<div style="margin-bottom: 5px;"><strong>Host Status:</strong> <span style="color: ${color}; font-weight: bold;">${status.overallStatus}</span></div>`;
                    break;
                }
            }

            let sectorHtml = '';
            if (sectorStatuses.length > 0) {
                sectorHtml = '<strong>Sectors:</strong><ul style="margin: 5px 0; padding-left: 15px;">';
                sectorStatuses.forEach(sector => {
                    const statusColor = sector.status === 'OK' || sector.status === 'UP' ? '#388e3c' : sector.status === 'CRITICAL' || sector.status === 'DOWN' ? '#d32f2f' : '#f57c00';
                    sectorHtml += `<li><span style="color: ${statusColor}; font-weight: bold;">${sector.name}</span> (${sector.status})</li>`;
                });
                sectorHtml += '</ul>';
            }

            infoWindow.setContent(`<div style="font-size: 14px;"><strong>${tower.id}</strong><br>Lat: ${tower.lat}<br>Lng: ${tower.lng}<br><strong>Has Links:</strong> ${hasLink ? 'Yes' : 'No'}<br>${hostStatusHtml}${sectorHtml}</div>`);
            infoWindow.open(AppState.map, marker);
        });

        AppState.towerMarkers.push({ tower, marker });
    });
}

// ADDED: Build cache of customer IDs to tower IDs for fast lookups
function buildCustomerTowerCache() {
    AppState.customerTowerCache = {};
    AppState.serviceLinks.forEach(link => {
        if (!AppState.customerTowerCache[link.customerId]) {
            AppState.customerTowerCache[link.customerId] = [];
        }
        AppState.customerTowerCache[link.customerId].push(link.towerId);
    });
}

// ADDED: Initialize markers once with lazy-loaded info windows
function initializeCustomerMarkers() {
    if (AppState.markersInitialized) return;
    console.log(`[Markers] Initializing markers for ${AppState.customers.length} customers...`);
    let createdCount = 0;
    let skippedCount = 0;
    
    AppState.customers.forEach(cust => {
        let lat, lng;

        // Resilient coordinate parsing
        if (cust.gps && typeof cust.gps === 'string') {
            // Remove brackets, "lat:", "lng:", and other noise
            const cleanGps = cust.gps.replace(/[\[\]{}()]/g, '').replace(/lat:|lng:|latitude:|longitude:/gi, '');
            const parts = cleanGps.split(',').map(p => parseFloat(p.trim()));
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                lat = parts[0];
                lng = parts[1];
            }
        } 
        
        if (lat === undefined || lng === undefined) {
            if (cust.lat !== undefined && cust.lng !== undefined) {
                lat = parseFloat(cust.lat);
                lng = parseFloat(cust.lng);
            } else if (cust.latitude !== undefined && cust.longitude !== undefined) {
                lat = parseFloat(cust.latitude);
                lng = parseFloat(cust.longitude);
            }
        }

        if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
            skippedCount++;
            if (skippedCount <= 5) console.warn(`[Markers] Skipping customer ${cust.id} (${cust.name}) due to invalid GPS:`, cust.gps);
            return;
        }

        // FIXED: Use custom "little man" icon with anger level
        const icon = getCustomerIcon(cust);

        // ADDED: Create marker without adding to map initially (unless already visible)
        const marker = new google.maps.Marker({
            position: { lat, lng },
            map: AppState.visibility.customers ? AppState.map : null,
            title: cust.name,
            icon: icon,
            // ADDED: Drop animation for customer markers
            animation: google.maps.Animation.DROP
        });

        // ADDED: Store customer, marker, and lazy-loaded info window
        AppState.customerMarkers.push({ customer: cust, marker, infoWindow: null });
        createdCount++;

        // ADDED: Re-create icons if lucide is available
        if (window.lucide) window.lucide.createIcons();

        // ADDED: Use shared helper for info window if available, otherwise define here
        marker.addListener("click", () => {
            if (window.AppState.bulkSelectMode) {
                const taskIds = (cust.tasks || []).map(t => t.ID || t.id).filter(id => id);
                if (taskIds.length > 0 && typeof window.addTasksToAssignment === 'function') {
                    window.addTasksToAssignment(taskIds.join(','));
                    // Add a visual pulse to the marker to show it was clicked
                    marker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => marker.setAnimation(null), 700);
                } else {
                    if (typeof showNotification === 'function') {
                        showNotification("No Tasks", "This customer has no active tasks to assign.", "warning");
                    }
                }
            } else if (typeof showCustomerInfoWindow === 'function') {
                const markerData = AppState.customerMarkers.find(m => m.marker === marker);
                showCustomerInfoWindow(markerData);
            } else {
                const markerData = AppState.customerMarkers.find(m => m.marker === marker);
                if (!markerData.infoWindow) {
                    markerData.infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div style="font-size: 14px;">
                                <strong>${cust.name}</strong><br>
                                ID: ${cust.id}<br>
                                GPS: ${cust.gps}<br>
                                <strong>Status:</strong> ${cust.status}<br>
                                <strong>Tasks:</strong> ${cust.tasks.length}
                            </div>
                        `
                    });
                }
                markerData.infoWindow.open(AppState.map, marker);
            }
        });
    });
    
    console.log(`[Markers] Created ${createdCount} markers, skipped ${skippedCount} (missing GPS)`);
    if (createdCount === 0 && AppState.customers.length > 0) {
        console.warn("[Markers] WARNING: Zero customer markers created despite having customer data. Checking first customer:", AppState.customers[0]);
    }
    AppState.markersInitialized = true;
}

// ADDED: Update marker visibility based on filters without recreating
function updateCustomerMarkerVisibility(animateLinks = false) {
    buildCustomerTowerCache();
    
    // ADDED: Get list of customer IDs for selected towers
    const customerIdsForSelectedTowers = new Set();
    if (AppState.filters.selectedTowers.length > 0) {
        AppState.filters.selectedTowers.forEach(towerId => {
            Object.keys(AppState.customerTowerCache).forEach(customerId => {
                if (AppState.customerTowerCache[customerId].includes(towerId)) {
                    customerIdsForSelectedTowers.add(parseInt(customerId));
                }
            });
        });
    }

    // ADDED: Check if customer has tasks with selected task statuses
    const hasMatchingTaskStatus = (customer) => {
        if (AppState.filters.selectedTaskStatuses.length === 0) return true;
        return customer.tasks.some(task => {
            const status = getTaskStatusLabel(task);
            return AppState.filters.selectedTaskStatuses.includes(status);
        });
    };

    // ADDED: Update visibility for each marker (no recreation)
    let shownCount = 0;
    let hiddenCount = 0;
    AppState.customerMarkers.forEach(({ customer, marker }) => {
        const isTowerSelected = AppState.filters.selectedTowers.length === 0 || customerIdsForSelectedTowers.has(customer.id);
        const isStatusSelected = AppState.filters.selectedStatuses.length === 0 || AppState.filters.selectedStatuses.includes(customer.status);
        const hasTaskStatus = hasMatchingTaskStatus(customer);
        const matchesSearch = !AppState.filters.query || (customer.name || "").toLowerCase().includes(AppState.filters.query);
        const shouldHideUnlinked = AppState.filters.hideUnlinkedCustomers && !customer.hasLink;
        const hasActiveTasks = !AppState.filters.filterActiveTasks || (customer.tasks && customer.tasks.length > 0);
        
        const shouldShow = AppState.visibility.customers && isTowerSelected && isStatusSelected && hasTaskStatus && matchesSearch && !shouldHideUnlinked && hasActiveTasks;
        
        if (shouldShow) shownCount++; else hiddenCount++;

        // Use setMap only if it changed to minimize updates
        if ((marker.getMap() !== null) !== shouldShow) {
            marker.setMap(shouldShow ? AppState.map : null);
        }
    });
    console.log(`Updated customer visibility: ${shownCount} shown, ${hiddenCount} hidden`);
    
    // ADDED: Update links as their visibility depends on customer visibility
    renderServiceLinks(animateLinks);

    // ADDED: Update customer list in sidebar
    renderCustomerList();
}

// ADDED: Render customer list in the sidebar
function renderCustomerList() {
    const listContainer = document.getElementById("customerList");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    // Sort customers by name
    const sortedCustomers = [...AppState.customers].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Filter by same logic as markers
    const filteredCustomers = sortedCustomers.filter(customer => {
        // Reuse same logic as updateCustomerMarkerVisibility
        const markerData = AppState.customerMarkers.find(m => m.customer.id === customer.id);
        const matchesSearch = !AppState.filters.query || (customer.name || "").toLowerCase().includes(AppState.filters.query);
        const isStatusSelected = AppState.filters.selectedStatuses.length === 0 || AppState.filters.selectedStatuses.includes(customer.status);
        
        // Check task status
        const hasMatchingTaskStatus = AppState.filters.selectedTaskStatuses.length === 0 || 
                                     customer.tasks.some(task => {
                                         const status = getTaskStatusLabel(task);
                                         return AppState.filters.selectedTaskStatuses.includes(status);
                                     });
        
        const shouldHideUnlinked = AppState.filters.hideUnlinkedCustomers && !customer.hasLink;
        const hasActiveTasks = !AppState.filters.filterActiveTasks || (customer.tasks && customer.tasks.length > 0);
        
        // Tower filter
        let isTowerSelected = true;
        if (AppState.filters.selectedTowers.length > 0) {
            const customerTowers = AppState.customerTowerCache[customer.id] || [];
            isTowerSelected = AppState.filters.selectedTowers.some(tid => customerTowers.includes(tid));
        }

        return matchesSearch && isStatusSelected && hasMatchingTaskStatus && !shouldHideUnlinked && isTowerSelected && hasActiveTasks;
    });

    if (filteredCustomers.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.875rem;">No customers found matching filters.</div>';
        return;
    }

    filteredCustomers.forEach(customer => {
        const item = document.createElement("div");
        item.className = "p-3 mb-2 rounded-xl bg-white/50 border border-white/50 hover:bg-white hover:border-primary-300 transition-all cursor-pointer shadow-sm group";
        
        const taskCount = customer.tasks ? customer.tasks.length : 0;
        const taskBadgeColor = taskCount > 3 ? "bg-red-100 text-red-600" : taskCount > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600";
        
        item.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <span class="font-bold text-slate-800 group-hover:text-primary-600 transition-colors">${customer.name}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full ${taskBadgeColor} font-bold">${taskCount}</span>
            </div>
            <div class="text-[10px] text-slate-500 flex justify-between items-center">
                <span>ID: ${customer.id}</span>
                <span class="capitalize">${customer.status}</span>
            </div>
        `;

        item.addEventListener("click", () => {
            const markerData = AppState.customerMarkers.find(m => m.customer.id === customer.id);
            if (markerData && markerData.marker) {
                AppState.map.panTo(markerData.marker.getPosition());
                AppState.map.setZoom(15);
                showCustomerInfoWindow(markerData);
            }
        });

        listContainer.appendChild(item);
    });
}

function renderMarkers() { // CHANGED: extracted marker logic into a function
    console.log("renderMarkers() called. Map initialized:", !!AppState.map, "Data loaded:", AppState.dataLoaded);
    // ADDED: Initialize markers on first render
    if (!AppState.markersInitialized) {
        initializeCustomerMarkers();
    }
    
    // ADDED: Render towers first (links depend on them)
    renderTowers();
    
    // ADDED: Update customer visibility (also updates links)
    updateCustomerMarkerVisibility();
    
    // ADDED: Initialize tower filter dropdown (only once if possible)
    initTowerFilter();
    
    // ADDED: Render tracker markers from server
    renderTrackerMarkers();
    
    // ADDED: Initialize tracker refresh controls and start real-time updates
    initTrackerRefreshControls();
    connectTrackerWebSocket();
    // Fallback polling starts only if WebSocket fails
    if (!AppState.trackerRefresh.wsConnected) {
        startTrackerRefreshLoop();
    }
    
    // FIXED: Initialize search filter after markers are rendered
    if (typeof initSearchFilter === 'function') {
        initSearchFilter();
    }
}

// ADDED: Save visibility to localStorage
function saveVisibility() {
    localStorage.setItem('belanet_map_visibility', JSON.stringify(AppState.visibility));
}

// ADDED: Toggle visibility of customers
function toggleCustomers() {
    AppState.visibility.customers = !AppState.visibility.customers;
    saveVisibility();
    updateCustomerMarkerVisibility();
}

// ADDED: Toggle visibility of towers
function toggleTowers() {
    AppState.visibility.towers = !AppState.visibility.towers;
    saveVisibility();
    renderTowers();
}

// ADDED: Toggle visibility of service links
function toggleLinks() {
    AppState.visibility.links = !AppState.visibility.links;
    saveVisibility();
    renderServiceLinks();
}

// ADDED: Toggle visibility of trackers
function toggleTrackers() {
    AppState.visibility.trackers = !AppState.visibility.trackers;
    saveVisibility();
    renderTrackerMarkers();
}

// ADDED: Toggle visibility of weather
function toggleWeather() {
    AppState.visibility.weather = !AppState.visibility.weather;
    saveVisibility();
    const wb = document.getElementById('toggleWeatherBtn');
    if (wb) wb.classList.toggle('active', AppState.visibility.weather);
    if (AppState.visibility.weather) {
        const cfg = window.AppConfig || {};
        const key = cfg.openWeatherKey;
        updateWeatherLayers();
        if (key && typeof WeatherOverlay !== 'undefined' && typeof WeatherService !== 'undefined' && typeof ClockManager !== 'undefined') {
            const c = AppState.map ? AppState.map.getCenter() : null;
            const lat = c ? c.lat() : -25.0;
            const lon = c ? c.lng() : 28.0;
            if (window.__WeatherOverlay && window.__WeatherOverlay._root) {
                window.__WeatherOverlay._root.style.display = '';
            } else {
                const svc = new WeatherService({ apiKey: key, ttl: { current: 300000, hourly: 600000, daily: 3600000 } });
                const clk = new ClockManager();
                const ov = new WeatherOverlay({ service: svc, clock: clk, lat, lon, id: 'map' });
                ov.mount(document.body);
                window.__WeatherOverlay = ov;
            }
        }
        startWeatherRefresh();
    } else {
        updateWeatherLayers();
        if (window.__WeatherOverlay && typeof window.__WeatherOverlay.destroy === 'function') {
            window.__WeatherOverlay.destroy();
            window.__WeatherOverlay = null;
        }
        stopWeatherRefresh();
    }
}

// ADDED: Initialize tower filter checkboxes
function initTowerFilter() {
    const filterCheckboxesContainer = document.getElementById("towerFilterCheckboxes");
    const hideUnlinkedCheckbox = document.getElementById("hideUnlinkedCheckbox");
    const hideUnlinkedCustomersCheckbox = document.getElementById("hideUnlinkedCustomersCheckbox");
    const filterActiveTasksCheckbox = document.getElementById("filterActiveTasksCheckbox");
    const selectAllBtn = document.getElementById("selectAllTowersBtn");
    const clearAllBtn = document.getElementById("clearAllTowersBtn");
    
    if (!filterCheckboxesContainer) return;

    filterCheckboxesContainer.innerHTML = '';
    filterCheckboxesContainer.style.display = "block";

    AppState.towers.forEach(tower => {
        const item = document.createElement("div");
        item.className = "tower-filter-item p-3 mb-2 rounded-xl bg-white/50 border border-white/50 hover:bg-white hover:border-primary-300 transition-all cursor-pointer shadow-sm group flex items-center gap-3";
        item.dataset.towerId = tower.id;
        
        if (AppState.filters.selectedTowers.includes(tower.id)) {
            item.classList.add("border-primary-500", "bg-primary-50/50");
        }

        const statusColor = getTowerStatusColor(tower.id);
        const statusText = statusColor === "#d32f2f" ? "Critical" : statusColor === "#f57c00" ? "Warning" : "Online";
        
        item.innerHTML = `
            <div class="w-3 h-3 rounded-full shadow-sm" style="background-color: ${statusColor};"></div>
            <div class="flex-1">
                <div class="font-bold text-slate-800 group-hover:text-primary-600 transition-colors text-sm">${tower.id}</div>
                <div class="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">${statusText}</div>
            </div>
            <div class="tower-checkbox w-5 h-5 rounded-lg border border-slate-200 flex items-center justify-center transition-all ${AppState.filters.selectedTowers.includes(tower.id) ? 'bg-primary-500 border-primary-500 shadow-md shadow-primary-200' : 'bg-white'}">
                ${AppState.filters.selectedTowers.includes(tower.id) ? '<i data-lucide="check" class="w-3.5 h-3.5 text-white"></i>' : ''}
            </div>
        `;
        
        item.addEventListener("click", () => {
            const index = AppState.filters.selectedTowers.indexOf(tower.id);
            if (index === -1) {
                AppState.filters.selectedTowers.push(tower.id);
            } else {
                AppState.filters.selectedTowers.splice(index, 1);
            }
            updateSelectedTowers();
        });
        
        filterCheckboxesContainer.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();

    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            AppState.filters.selectedTowers = AppState.towers.map(t => t.id);
            updateSelectedTowers();
        };
    }

    if (clearAllBtn) {
        clearAllBtn.onclick = () => {
            AppState.filters.selectedTowers = [];
            updateSelectedTowers();
        };
    }

    if (hideUnlinkedCheckbox) {
        hideUnlinkedCheckbox.addEventListener("change", () => {
            AppState.filters.hideUnlinkedTowers = hideUnlinkedCheckbox.checked;
            renderTowers();
            renderServiceLinks();
        });
    }

    if (hideUnlinkedCustomersCheckbox) {
        hideUnlinkedCustomersCheckbox.addEventListener("change", () => {
            AppState.filters.hideUnlinkedCustomers = hideUnlinkedCustomersCheckbox.checked;
            updateCustomerMarkerVisibility();
        });
    }

    if (filterActiveTasksCheckbox) {
        filterActiveTasksCheckbox.addEventListener("change", () => {
            AppState.filters.filterActiveTasks = filterActiveTasksCheckbox.checked;
            updateCustomerMarkerVisibility();
        });
    }

    initStatusFilter();
    initTaskSearch();
}

// ADDED: Initialize status filter checkboxes
function initStatusFilter() {
    const statusCheckboxesContainer = document.getElementById("statusFilterCheckboxes");
    const selectAllStatusBtn = document.getElementById("selectAllStatusBtn");
    const clearAllStatusBtn = document.getElementById("clearAllStatusBtn");
    
    if (!statusCheckboxesContainer) return;

    // ADDED: Get unique customer statuses
    const uniqueStatuses = [...new Set(AppState.customers.map(c => c.status))].sort();

    // ADDED: Clear existing checkboxes
    statusCheckboxesContainer.innerHTML = '';

    // ADDED: Add each status as a checkbox
    uniqueStatuses.forEach(status => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = status;
        checkbox.className = "status-filter-checkbox";
        
        // ADDED: Listen for individual checkbox changes
        checkbox.addEventListener("change", () => {
            updateSelectedStatuses();
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(status));
        statusCheckboxesContainer.appendChild(label);
    });

    // ADDED: Select All button
    if (selectAllStatusBtn) {
        selectAllStatusBtn.addEventListener("click", () => {
            document.querySelectorAll(".status-filter-checkbox").forEach(cb => cb.checked = true);
            updateSelectedStatuses();
        });
    }

    // ADDED: Clear All button
    if (clearAllStatusBtn) {
        clearAllStatusBtn.addEventListener("click", () => {
            document.querySelectorAll(".status-filter-checkbox").forEach(cb => cb.checked = false);
            updateSelectedStatuses();
        });
    }

    // ADDED: Initialize task status filter after status filter
    initTaskStatusFilter();
}

// ADDED: Initialize task status filter checkboxes
function initTaskStatusFilter() {
    const taskStatusCheckboxesContainer = document.getElementById("taskStatusFilterCheckboxes");
    const selectAllTaskStatusBtn = document.getElementById("selectAllTaskStatusBtn");
    const clearAllTaskStatusBtn = document.getElementById("clearAllTaskStatusBtn");
    
    if (!taskStatusCheckboxesContainer) return;

    // ADDED: Get unique task statuses from all tasks, excluding finished ones
    const uniqueTaskStatuses = [...new Set(AppState.tasks
        .map(t => getTaskStatusLabel(t))
        .filter(s => s !== "Closed" && s !== "Resolved" && s !== "Rejected")
    )].sort();

    // ADDED: Clear existing checkboxes
    taskStatusCheckboxesContainer.innerHTML = '';

    // ADDED: Add each task status as a checkbox
    uniqueTaskStatuses.forEach(status => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = status;
        checkbox.className = "task-status-filter-checkbox";
        
        // ADDED: Listen for individual checkbox changes
        checkbox.addEventListener("change", () => {
            updateSelectedTaskStatuses();
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(status));
        taskStatusCheckboxesContainer.appendChild(label);
    });

    // ADDED: Select All button
    if (selectAllTaskStatusBtn) {
        selectAllTaskStatusBtn.addEventListener("click", () => {
            document.querySelectorAll(".task-status-filter-checkbox").forEach(cb => cb.checked = true);
            updateSelectedTaskStatuses();
        });
    }

    // ADDED: Clear All button
    if (clearAllTaskStatusBtn) {
        clearAllTaskStatusBtn.addEventListener("click", () => {
            document.querySelectorAll(".task-status-filter-checkbox").forEach(cb => cb.checked = false);
            updateSelectedTaskStatuses();
        });
    }
}

// ADDED: Update selected towers from checkboxes and re-render
function updateSelectedTowers() {
    const container = document.getElementById("towerFilterCheckboxes");
    if (container) {
        const items = container.querySelectorAll(".tower-filter-item");
        items.forEach(item => {
            const towerId = item.dataset.towerId;
            const isSelected = AppState.filters.selectedTowers.includes(towerId);
            
            const checkbox = item.querySelector(".tower-checkbox");
            if (isSelected) {
                item.classList.add("border-primary-500", "bg-primary-50/50");
                checkbox.classList.add("bg-primary-500", "border-primary-500");
                checkbox.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-white"></i>';
            } else {
                item.classList.remove("border-primary-500", "bg-primary-50/50");
                checkbox.classList.remove("bg-primary-500", "border-primary-500");
                checkbox.innerHTML = '';
            }
        });
        if (window.lucide) window.lucide.createIcons();
    }

    updateCustomerMarkerVisibility();
    renderTowers();
    renderServiceLinks();
    
    // ADDED: Zoom to single selected tower
    if (AppState.filters.selectedTowers.length === 1) {
        const towerId = AppState.filters.selectedTowers[0];
        const tower = AppState.towers.find(t => t.id === towerId);
        if (tower && AppState.map) {
            AppState.map.panTo({ lat: tower.lat, lng: tower.lng });
            AppState.map.setZoom(12);
        }
    }
}

// ADDED: Update selected statuses from checkboxes and re-render
function updateSelectedStatuses() {
    AppState.filters.selectedStatuses = Array.from(document.querySelectorAll(".status-filter-checkbox:checked"))
        .map(cb => cb.value);
    updateCustomerMarkerVisibility();
}

// ADDED: Update selected task statuses from checkboxes and re-render
function updateSelectedTaskStatuses() {
    AppState.filters.selectedTaskStatuses = Array.from(document.querySelectorAll(".task-status-filter-checkbox:checked"))
        .map(cb => cb.value);
    updateCustomerMarkerVisibility();
}

// ADDED: Map tasks to customers by name or ID
function mapTasksToCustomers() {
    if (!AppState.customers || !AppState.tasks) return;
    
    // Clear existing tasks from customers
    AppState.customers.forEach(cust => cust.tasks = []);
    
    // Create name lookup
    const customerByName = {};
    AppState.customers.forEach(cust => customerByName[cust.name] = cust);

    AppState.tasks.forEach(task => {
        const status = getTaskStatusLabel(task);
        
        // Only map active tasks to customers for the "anger" icons and customer info
        // We filter out Closed, Resolved, and Rejected tasks
        if (status === "Closed" || status === "Resolved" || status === "Rejected") {
            return;
        }

        let customer = null;
        const customerId = task.related_customer_id || task.customer_id;
        
        if (task.Customer) {
            customer = customerByName[task.Customer];
        } else if (customerId) {
            customer = AppState.customerById[String(customerId)];
        }
        
        if (customer) {
            customer.tasks.push(task);
        }
    });
}

// ADDED: Render all tasks in the global Tasks tab
function renderGlobalTasksList() {
    const listContainer = document.getElementById("tasksList");
    const countBadge = document.getElementById("taskCountBadge");
    const searchInput = document.getElementById("taskSearchInput");
    
    if (!listContainer || !AppState.tasks) return;

    const query = (searchInput ? searchInput.value : "").toLowerCase();
    
    // Filter tasks based on search query and active status
    const filteredTasks = AppState.tasks.filter(task => {
        const status = getTaskStatusLabel(task);
        
        // Hide finished tasks from global list too, unless specifically searched or filtered?
        // For now, let's keep it consistent: hide ghost tasks
        if (status === "Closed" || status === "Resolved" || status === "Rejected") {
            return false;
        }

        const id = String(task.ID || task.id || "");
        const title = (task.Title || task.title || task.subject || "").toLowerCase();
        const customer = (task.Customer || "").toLowerCase();
        const customerId = task.related_customer_id || task.customer_id;
        
        // If we have customer_id but no Customer name, try to find it
        let customerName = customer;
        if (!customerName && customerId) {
            const cust = AppState.customerById[String(customerId)];
            if (cust) customerName = cust.name.toLowerCase();
        }

        return id.includes(query) || title.includes(query) || customerName.includes(query);
    });

    if (countBadge) countBadge.textContent = filteredTasks.length;

    listContainer.innerHTML = "";

    if (filteredTasks.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b; font-size: 0.875rem;">No tasks found.</div>';
        return;
    }

    filteredTasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "p-4 mb-3 rounded-xl bg-white/50 border border-white/50 hover:bg-white hover:border-primary-300 transition-all cursor-pointer shadow-sm group";
        
        const status = getTaskStatusLabel(task);
        const title = task.Title || task.title || task.subject || "No Title";
        const id = task.ID || task.id;
        const customerId = task.related_customer_id || task.customer_id;
        
        // Find customer name for display
        let customerName = task.Customer;
        let customerObj = null;
        if (!customerName && customerId) {
            customerObj = AppState.customerById[String(customerId)];
            if (customerObj) customerName = customerObj.name;
        } else if (task.Customer) {
            customerObj = Object.values(AppState.customerById).find(c => c.name === task.Customer);
        }

        item.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">#${id}</span>
                <span class="text-[10px] font-medium text-slate-400 capitalize">${status}</span>
            </div>
            <div class="font-bold text-slate-800 group-hover:text-primary-600 transition-colors mb-1">${title}</div>
            <div class="text-xs text-slate-500 flex items-center gap-1">
                <i data-lucide="user" class="w-3 h-3"></i>
                <span>${customerName || "No Customer"}</span>
            </div>
        `;

        item.onclick = () => {
            if (customerObj && customerObj.gps) {
                const parts = customerObj.gps.split(',').map(Number);
                if (parts.length === 2) {
                    AppState.map.setCenter({ lat: parts[0], lng: parts[1] });
                    AppState.map.setZoom(16);
                    
                    // Find and open marker
                    const markerData = AppState.customerMarkers.find(m => m.customer.id === customerObj.id);
                    if (markerData && typeof showCustomerInfoWindow === 'function') {
                        showCustomerInfoWindow(markerData);
                    }
                }
            }
        };

        listContainer.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();
}

// ADDED: Initialize task search
function initTaskSearch() {
    const searchInput = document.getElementById("taskSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderGlobalTasksList();
        });
    }
}

// ADDED: Update tower filter button text
function updateTowerFilterButton() {
    const count = AppState.filters.selectedTowers.length;
    const btnElement = document.getElementById("towerFilterBtn");
    if (btnElement) {
        btnElement.textContent = `Tower Filter: ${count} selected`;
    }
}


// =====================
// START DATA LOAD
// =====================

loadData(); // CHANGED: replaces illegal top-level await

// ADDED: Cleanup on page unload
window.addEventListener("beforeunload", () => {
    stopTrackerRefreshLoop();
});
