// FIXED: Must use window.AppState for global access in other scripts
window.AppState = {
    map: null,
    // FIXED: Initialize as null, not [], so data loading checks work properly
    customers: null,
    customerMarkers: [],
    tasks: null,
    towers: null,
    // ADDED: Tower markers storage
    towerMarkers: [],
    // ADDED: Nagios service status for towers
    nagiosStatus: {},
    // ADDED: Service logins data and polylines storage
    serviceLogins: null,
    serviceLinks: [],
    // ADDED: Polylines storage for service connections
    polylines: [],
    // ADDED: Tracker data and markers storage
    trackerPositions: null,
    trackerMarkers: [],
    // ADDED: Weather layers and strikes
    weatherLayers: {},
    strikeMarkers: [],
    weatherData: {
        current: null,
        forecast: null,
        lastUpdate: 0
    },
    weatherRefresh: {
        timer: null,
        interval: 300000
    },
    dataLoaded: false,
    customerById: {},
    // ADDED: Load visibility from localStorage or use defaults
    visibility: (function() {
        const defaults = {
            customers: true,
            towers: false,
            links: false,
            trackers: true,
            weather: false
        };
        const nsKey = 'belanet:v1:ui:visibility';
        try {
            const raw = localStorage.getItem(nsKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.v === 1 && parsed.data && typeof parsed.data === 'object') {
                    const d = parsed.data;
                    const valid = {
                        customers: !!d.customers,
                        towers: !!d.towers,
                        links: !!d.links,
                        trackers: !!d.trackers,
                        weather: !!d.weather
                    };
                    return { ...defaults, ...valid };
                }
            } else {
                const legacy = localStorage.getItem('belanet_map_visibility');
                if (legacy) {
                    const lv = JSON.parse(legacy) || {};
                    const valid = {
                        customers: !!lv.customers,
                        towers: !!lv.towers,
                        links: !!lv.links,
                        trackers: !!lv.trackers,
                        weather: !!lv.weather
                    };
                    const wrapped = { v: 1, data: { ...defaults, ...valid } };
                    try { localStorage.setItem(nsKey, JSON.stringify(wrapped)); } catch (_) {}
                    return wrapped.data;
                }
            }
        } catch (_) {}
        try { localStorage.setItem(nsKey, JSON.stringify({ v: 1, data: defaults })); } catch (_) {}
        return defaults;
    })(),
    filters: {
        query: "",
        showInactive: true,
        // ADDED: Tower filter for links
        selectedTowers: [],
        // ADDED: Status filter for customers
        selectedStatuses: [],
        // ADDED: Task status filter for customers
        selectedTaskStatuses: [],
        // ADDED: Hide towers without links
        hideUnlinkedTowers: false,
        // ADDED: Hide customers without links
        hideUnlinkedCustomers: false,
        // ADDED: Filter customers by active tasks
        filterActiveTasks: false
    },
    // ADDED: Track whether markers have been initialized
    markersInitialized: false,
    // ADDED: Cache for customer-to-tower associations
    customerTowerCache: {},
    // ADDED: Tracker refresh settings
    trackerRefresh: {
        enabled: true,
        interval: 10000,
        timer: null,
        // ADDED: WebSocket connection
        ws: null,
        wsConnected: false,
        useFallback: false
    },
    // ADDED: Playground Mode / Simulation state
    simulation: {
        active: false,
        speed: 1.0,
        workSpeed: 1.0,
        time: Date.now(), // Virtual simulation time
        agents: [], // { id, name, marker, path: [], currentPointIndex, speed, status }
        tasks: [], // Simulated tasks
        outages: [], // Simulated tower outages
        maxTasksPerAgent: 10,
        priorityFactors: {
            distance: 1.0,
            age: 1.5,
            business: 2.0,
            complexity: 1.2,
            lineSize: 1.0
        }
    },
    // ADDED: Team Management state
    team: {
        administrators: [], // All available administrators from API
        members: [], // Added team members (persisted)
        activeMemberId: null, // Currently expanded member
        expandedSidebar: false // Whether the right sidebar is fully expanded
    },
    // ADDED: SLA configuration with localStorage persistence
    slaConfig: (function(){
        const defaults = { amberHours: 8, redHours: 24 };
        const nsKey = 'belanet:v1:sla:config';
        try {
            const raw = localStorage.getItem(nsKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                const cfg = parsed && parsed.v === 1 && parsed.data ? parsed.data : parsed;
                const amber = parseInt(cfg && cfg.amberHours);
                const red = parseInt(cfg && cfg.redHours);
                if (!isNaN(amber) && !isNaN(red) && red >= amber && amber > 0) {
                    return { amberHours: amber, redHours: red };
                }
            } else {
                const legacy = localStorage.getItem('belanet_sla_config');
                if (legacy) {
                    const cfg = JSON.parse(legacy) || {};
                    const amber = parseInt(cfg.amberHours);
                    const red = parseInt(cfg.redHours);
                    if (!isNaN(amber) && !isNaN(red) && red >= amber && amber > 0) {
                        const wrapped = { v: 1, data: { amberHours: amber, redHours: red } };
                        try { localStorage.setItem(nsKey, JSON.stringify(wrapped)); } catch (_) {}
                        return wrapped.data;
                    }
                }
            }
        } catch (_) {}
        try { localStorage.setItem(nsKey, JSON.stringify({ v: 1, data: defaults })); } catch (_) {}
        return defaults;
    })(),
    metricsHistory: { openTickets: [], critical: [] }
};

// ADDED: Global helper to trigger UI updates
window.triggerStateChange = function(detail = {}) {
    window.dispatchEvent(new CustomEvent('stateChanged', { detail }));
};