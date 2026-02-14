/**
 * OperationalDashboard.js
 * Comprehensive logic for the ISP Heartbeat and Task Management Dashboard.
 * Handles both Live (Splynx/Nagios/Trackers) and Simulation data.
 */

document.addEventListener('DOMContentLoaded', () => {
    // FIXED: Removed polling loop; using event-driven updates
    // setInterval(updateOperationalDashboard, 2000); 
    
    // Listen for state changes
    window.addEventListener('stateChanged', (e) => {
        updateOperationalDashboard(e.detail);
    });

    // Initial update
    setTimeout(updateOperationalDashboard, 1000);

    // Attach Dashboard Toggle Buttons
    const openBtn = document.getElementById("openTaskDashBtn");
    const closeBtn = document.getElementById("closeTaskDashBtn");
    const dash = document.getElementById("taskDashboard");

    if (openBtn && dash) {
        openBtn.addEventListener("click", () => {
            dash.classList.remove("hidden");
            dash.classList.add("animate__animated", "animate__fadeIn", "dashboard-opening");
            AppState.dashboardOpening = true;
            updateOperationalDashboard();
            
            // Remove opening flag after animations finish
            setTimeout(() => {
                dash.classList.remove("dashboard-opening");
                AppState.dashboardOpening = false;
            }, 1000);
        });
    }

    if (closeBtn && dash) {
        closeBtn.addEventListener("click", () => {
            dash.classList.remove("animate__fadeIn", "dashboard-opening");
            dash.classList.add("animate__fadeOut");
            setTimeout(() => {
                dash.classList.add("hidden");
                dash.classList.remove("animate__animated", "animate__fadeOut");
            }, 500);
        });
    }

    // Toggle Strategy Panel
    const toggleStrategyBtn = document.getElementById("toggleStrategyBtn");
    const strategyPanel = document.getElementById("strategyPanel");
    if (toggleStrategyBtn && strategyPanel) {
        // Initial state sync
        if (strategyPanel.classList.contains("hidden")) {
            toggleStrategyBtn.classList.remove("bg-primary-600", "text-white");
        } else {
            toggleStrategyBtn.classList.add("bg-primary-600", "text-white");
        }

        toggleStrategyBtn.addEventListener("click", () => {
            const isHidden = strategyPanel.classList.toggle("hidden");
            toggleStrategyBtn.classList.toggle("bg-primary-600", !isHidden);
            toggleStrategyBtn.classList.toggle("text-white", !isHidden);
            // Trigger a re-render to ensure layout adapts
            updateOperationalDashboard();
        });
    }

    // Attach Optimization Button (if present)
    const reOptimizeBtn = document.getElementById("applyOptimizationBtn");
    if (reOptimizeBtn) {
        reOptimizeBtn.addEventListener("click", () => {
            if (typeof redistributeAllTasks === 'function') {
                redistributeAllTasks();
                showNotification("Optimization", "Re-calculating all agent routes based on new priorities...", "success");
            } else if (typeof optimizeAgentRoutes === 'function') {
                optimizeAgentRoutes();
                showNotification("Optimization", "Re-calculating routes...", "info");
            }
        });
    }

    // Register Work Speed Slider
    const workSpeedSlider = document.getElementById("workSpeedSlider");
    const workSpeedValue = document.getElementById("workSpeedValue");
    if (workSpeedSlider && workSpeedValue) {
        workSpeedSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            AppState.simulation.workSpeed = val;
            workSpeedValue.innerText = `${val}.0x`;
        };
    }

    // Attach Shorten Time Button
    const shortenTimeBtn = document.getElementById("shortenWorkTimeBtn");
    if (shortenTimeBtn) {
        shortenTimeBtn.onclick = () => {
            if (typeof shortenCurrentTasks === 'function') {
                shortenCurrentTasks();
            }
        };
    }

    // ADDED: Dashboard Search and Filters
    const dashSearch = document.getElementById("dashTaskSearch");
    const toggleGridView = document.getElementById("toggleTaskGridViewBtn");

    if (dashSearch) {
        dashSearch.addEventListener("input", () => updateOperationalDashboard());
    }
    if (toggleGridView) {
        toggleGridView.addEventListener("click", () => {
            AppState.dashboardGridView = !AppState.dashboardGridView;
            toggleGridView.classList.toggle("bg-primary-100", AppState.dashboardGridView);
            toggleGridView.classList.toggle("text-primary-600", AppState.dashboardGridView);
            updateOperationalDashboard();
        });
    }

    // New: Initialize and bind Filtering & Sorting controls with persistence
    if (!AppState.taskFilters) {
        try {
            const saved = localStorage.getItem('belanet_task_filters_v1');
            AppState.taskFilters = saved ? JSON.parse(saved) : null;
        } catch (_) { AppState.taskFilters = null; }
        if (!AppState.taskFilters) {
            AppState.taskFilters = {
                priorities: { critical: true, high: true, medium: true, low: true },
                status: 'all',
                customer: 'all',
                age: 'all',
                unassignedOnly: false,
                sort: 'urgent'
            };
        }
    }
    const persistFilters = () => { try { localStorage.setItem('belanet_task_filters_v1', JSON.stringify(AppState.taskFilters)); } catch(_) {} };

    const fPriCritical = document.getElementById('fPriCritical');
    const fPriHigh = document.getElementById('fPriHigh');
    const fPriMedium = document.getElementById('fPriMedium');
    const fPriLow = document.getElementById('fPriLow');
    const fStatus = document.getElementById('dashTaskStatusFilter');
    const fCustomer = document.getElementById('dashTaskCustomerFilter');
    const fAge = document.getElementById('dashTaskAgeFilter');
    const fUnassigned = document.getElementById('dashUnassignedOnly');
    const fSort = document.getElementById('dashSortPreset');

    if (fPriCritical) fPriCritical.checked = !!AppState.taskFilters.priorities.critical;
    if (fPriHigh) fPriHigh.checked = !!AppState.taskFilters.priorities.high;
    if (fPriMedium) fPriMedium.checked = !!AppState.taskFilters.priorities.medium;
    if (fPriLow) fPriLow.checked = !!AppState.taskFilters.priorities.low;
    if (fAge) fAge.value = AppState.taskFilters.age || 'all';
    if (fUnassigned) fUnassigned.checked = !!AppState.taskFilters.unassignedOnly;
    if (fSort) fSort.value = AppState.taskFilters.sort || 'urgent';

    const onChange = () => { persistFilters(); updateOperationalDashboard(); };
    if (fPriCritical) fPriCritical.onchange = () => { AppState.taskFilters.priorities.critical = fPriCritical.checked; onChange(); };
    if (fPriHigh) fPriHigh.onchange = () => { AppState.taskFilters.priorities.high = fPriHigh.checked; onChange(); };
    if (fPriMedium) fPriMedium.onchange = () => { AppState.taskFilters.priorities.medium = fPriMedium.checked; onChange(); };
    if (fPriLow) fPriLow.onchange = () => { AppState.taskFilters.priorities.low = fPriLow.checked; onChange(); };
    if (fStatus) fStatus.onchange = () => { AppState.taskFilters.status = fStatus.value; onChange(); };
    if (fCustomer) fCustomer.onchange = () => { AppState.taskFilters.customer = fCustomer.value; onChange(); };
    if (fAge) fAge.onchange = () => { AppState.taskFilters.age = fAge.value; onChange(); };
    if (fUnassigned) fUnassigned.onchange = () => { AppState.taskFilters.unassignedOnly = fUnassigned.checked; onChange(); };
    if (fSort) fSort.onchange = () => { AppState.taskFilters.sort = fSort.value; onChange(); };


    if (typeof AppState.activeMetricFilter === 'undefined') AppState.activeMetricFilter = null;
    const setMetricFilter = (type) => {
        if (type === 'open') {
            AppState.taskFilters.status = 'open';
            AppState.activeMetricFilter = 'open';
            const fStatusEl = document.getElementById('dashTaskStatusFilter');
            if (fStatusEl) fStatusEl.value = 'open';
        } else if (type === 'critical') {
            AppState.taskFilters.priorities = { critical: true, high: false, medium: false, low: false };
            AppState.activeMetricFilter = 'critical';
            const fPriCriticalEl = document.getElementById('fPriCritical');
            const fPriHighEl = document.getElementById('fPriHigh');
            const fPriMediumEl = document.getElementById('fPriMedium');
            const fPriLowEl = document.getElementById('fPriLow');
            if (fPriCriticalEl) fPriCriticalEl.checked = true;
            if (fPriHighEl) fPriHighEl.checked = false;
            if (fPriMediumEl) fPriMediumEl.checked = false;
            if (fPriLowEl) fPriLowEl.checked = false;
        } else {
            AppState.activeMetricFilter = null;
            AppState.taskFilters.status = 'all';
            AppState.taskFilters.priorities = { critical: true, high: true, medium: true, low: true };
            const fStatusEl = document.getElementById('dashTaskStatusFilter');
            if (fStatusEl) fStatusEl.value = 'all';
            const fPriCriticalEl = document.getElementById('fPriCritical');
            const fPriHighEl = document.getElementById('fPriHigh');
            const fPriMediumEl = document.getElementById('fPriMedium');
            const fPriLowEl = document.getElementById('fPriLow');
            if (fPriCriticalEl) fPriCriticalEl.checked = true;
            if (fPriHighEl) fPriHighEl.checked = true;
            if (fPriMediumEl) fPriMediumEl.checked = true;
            if (fPriLowEl) fPriLowEl.checked = true;
        }
        try { localStorage.setItem('belanet_task_filters_v1', JSON.stringify(AppState.taskFilters)); } catch(_) {}
        updateOperationalDashboard();
    };
    const openTicketsCard = document.getElementById('hbOpenTickets') ? document.getElementById('hbOpenTickets').closest('.heartbeat-stat') : null;
    const criticalCard = document.getElementById('hbCriticalTasks') ? document.getElementById('hbCriticalTasks').closest('.heartbeat-stat') : null;
    if (openTicketsCard) {
        openTicketsCard.classList.add('cursor-pointer');
        openTicketsCard.onclick = () => setMetricFilter('open');
    }
    if (criticalCard) {
        criticalCard.classList.add('cursor-pointer');
        criticalCard.onclick = () => setMetricFilter('critical');
    }

    // Initialize new AppState variables
    if (!AppState.dashboardGridCols) AppState.dashboardGridCols = 2;
    if (!AppState.selectedTasks) AppState.selectedTasks = new Set();
    if (!AppState.activeTargetTechId) AppState.activeTargetTechId = null;
    if (!AppState.expandedTasks) AppState.expandedTasks = new Set();

    // SLA Config Controls
    const slaAmberInput = document.getElementById('slaAmberHoursInput');
    const slaRedInput = document.getElementById('slaRedHoursInput');
    const slaResetBtn = document.getElementById('slaResetBtn');
    if (slaAmberInput && slaRedInput) {
        const cfg = AppState.slaConfig || { amberHours: 8, redHours: 24 };
        slaAmberInput.value = cfg.amberHours;
        slaRedInput.value = cfg.redHours;
        const persist = () => {
            const amber = Math.max(1, parseInt(slaAmberInput.value || '8'));
            const red = Math.max(amber, parseInt(slaRedInput.value || '24'));
            AppState.slaConfig = { amberHours: amber, redHours: red };
            try { localStorage.setItem('belanet_sla_config', JSON.stringify(AppState.slaConfig)); } catch (e) {}
            updateOperationalDashboard();
        };
        slaAmberInput.oninput = persist;
        slaRedInput.oninput = persist;
        if (slaResetBtn) {
            slaResetBtn.onclick = () => {
                slaAmberInput.value = 8;
                slaRedInput.value = 24;
                persist();
            };
        }
    }

    // Grid Columns Slider
    const gridColsSlider = document.getElementById("dashGridCols");
    const gridColsVal = document.getElementById("dashGridColsVal");
    if (gridColsSlider && gridColsVal) {
        gridColsSlider.value = AppState.dashboardGridCols;
        gridColsVal.innerText = AppState.dashboardGridCols;
        gridColsSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            AppState.dashboardGridCols = val;
            gridColsVal.innerText = val;
            updateOperationalDashboard();
        };
    }

    // Density Toggle
    (function(){
        const compactBtn = document.getElementById('densityCompactBtn');
        const comfortBtn = document.getElementById('densityComfortBtn');
        const dashEl = document.getElementById('taskDashboard');
        if (dashEl) {
            if (!AppState.dashboardDensity) {
                try {
                    const saved = localStorage.getItem('belanet_density');
                    AppState.dashboardDensity = saved === 'compact' ? 'compact' : 'comfortable';
                } catch (_) { AppState.dashboardDensity = 'comfortable'; }
            }
            const apply = () => {
                const isCompact = AppState.dashboardDensity === 'compact';
                dashEl.classList.toggle('density-compact', isCompact);
                if (compactBtn && comfortBtn) {
                    compactBtn.classList.toggle('active', isCompact);
                    comfortBtn.classList.toggle('active', !isCompact);
                }
                updateOperationalDashboard();
            };
            if (compactBtn) compactBtn.onclick = (e) => {
                e.preventDefault();
                AppState.dashboardDensity = 'compact';
                try { localStorage.setItem('belanet_density', 'compact'); } catch(_){ }
                apply();
            };
            if (comfortBtn) comfortBtn.onclick = (e) => {
                e.preventDefault();
                AppState.dashboardDensity = 'comfortable';
                try { localStorage.setItem('belanet_density', 'comfortable'); } catch(_){ }
                apply();
            };
            dashEl.classList.toggle('density-compact', AppState.dashboardDensity === 'compact');
            if (compactBtn && comfortBtn) {
                compactBtn.classList.toggle('active', AppState.dashboardDensity === 'compact');
                comfortBtn.classList.toggle('active', AppState.dashboardDensity !== 'compact');
            }
        }
    })();

    // Select All Visible
    const selectAllBtn = document.getElementById("selectAllTasksBtn");
    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            const taskCards = document.querySelectorAll('.task-dashboard-card:not(.assigned)');
            taskCards.forEach(card => {
                const taskId = card.dataset.taskId;
                if (taskId) AppState.selectedTasks.add(taskId);
            });
            updateOperationalDashboard();
        };
    }

    // Bulk Assignment Handlers
    const confirmBulkBtn = document.getElementById("confirmBulkAssignBtn");
    const cancelBulkBtn = document.getElementById("cancelBulkAssignBtn");

    if (confirmBulkBtn) {
        confirmBulkBtn.onclick = () => {
            if (AppState.activeTargetTechId && AppState.selectedTasks.size > 0) {
                const tech = aggregateAllAgents().find(a => a.id === AppState.activeTargetTechId);
                AppState.selectedTasks.forEach(taskId => {
                    handleTaskAssignment(taskId, AppState.activeTargetTechId, tech?.isLive);
                });
                showNotification("Bulk Assignment", `Assigned ${AppState.selectedTasks.size} tasks to ${tech?.name}`, "success");
                AppState.selectedTasks.clear();
                AppState.activeTargetTechId = null;
                updateOperationalDashboard();
            }
        };
    }

    if (cancelBulkBtn) {
        cancelBulkBtn.onclick = () => {
            AppState.selectedTasks.clear();
            AppState.activeTargetTechId = null;
            updateOperationalDashboard();
        };
    }
});

/**
 * Main dashboard update function
 */
function updateOperationalDashboard() {
    if (!AppState || !document.getElementById("taskDashboard") || document.getElementById("taskDashboard").classList.contains("hidden")) return;

    const allTasks = aggregateAllTasks();
    const allAgents = aggregateAllAgents();

    updateHeartbeatMetrics(allTasks, allAgents);
    updateTechnicianGrid(allAgents);
    updatePriorityTaskQueue(allTasks);

    // Refresh icons
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Handles Drag & Drop Assignment
 */
function handleTaskAssignment(taskId, agentId, agentIsLive) {
    if (!agentIsLive) {
        // Manual assignment for Simulation
        if (typeof assignTaskToAgent === 'function') {
            const result = assignTaskToAgent(taskId, agentId);
            if (result && !result.success) {
                // Failure already notified in assignTaskToAgent
                return false;
            }
            return true;
        } else {
            console.error("assignTaskToAgent not found");
            return false;
        }
    } else {
        // Live Assignment
        if (typeof window.assignTaskToTechnician === 'function') {
            window.assignTaskToTechnician(taskId, agentId);
            return true;
        } else {
            showNotification("Live Assignment", "Forwarding to Splynx API...", "info");
            return true;
        }
    }
}

// Global aliases
window.updateDashboardContent = updateOperationalDashboard;
window.updateOperationalDashboard = updateOperationalDashboard;

/**
 * Aggregates both Splynx and Simulated tasks
 */
function aggregateAllTasks() {
    const tasks = [];
    
    // 1. Splynx Tasks
    if (AppState.tasks) {
        AppState.tasks.forEach(t => {
            const status = typeof getTaskStatusLabel === 'function' ? getTaskStatusLabel(t) : (t.status || "Unknown");
            if (status !== "Closed" && status !== "Resolved" && status !== "Rejected") {
                tasks.push({ 
                    ...t, 
                    isLive: true,
                    title: t.Title || t.subject || "Unnamed Task",
                    customer: t.Customer || "Unknown Customer",
                    priority: t.priority || t.Priority || "Medium",
                    status: status,
                    assigneeId: t.assignee || t.assignee_id || t.assigned_to || t.technician_id || null,
                    createdAt: new Date(t.date_created || t.created_at || Date.now()).getTime(),
                    updatedAt: new Date(t['Updated at'] || t.updated_at || t.date_updated || t.updatedAt || t.updated || t.modified || t.mod_time || t.last_update || t.last_updated || t.lastUpdated || Date.now()).getTime()
                });
            }
        });
    }
    
    // 2. Simulated Tasks
    if (AppState.simulation.tasks && AppState.simulation.tasks.length > 0) {
        AppState.simulation.tasks.forEach(t => {
            // Check if still active (not completed)
            const isCompleted = AppState.simulation.agents && AppState.simulation.agents.some(a => a.stats?.completedTasks?.includes(t.id));
            if (!isCompleted) {
                tasks.push({
                    ...t,
                    isLive: false,
                    title: t.description || t.name || "Simulated Task",
                    customer: t.Customer || "Sim Customer",
                    priority: t.priority || "Medium",
                    createdAt: t.createdTime || Date.now(),
                    updatedAt: t.updatedTime || t.lastUpdated || t.modifiedAt || t.createdTime || Date.now(),
                    isSimulated: true // ADDED: Flag for styling
                });
            }
        });
    }
    
    // Sort: Simulated/Emergency first, then by priority, then by age
    return tasks.sort((a, b) => {
        // Priority Score
        const priorityScore = { "Critical": 100, "High": 75, "Medium": 50, "Low": 25 };
        const scoreA = (priorityScore[a.priority] || 50) + (a.isSimulated ? 1000 : 0);
        const scoreB = (priorityScore[b.priority] || 50) + (b.isSimulated ? 1000 : 0);
        
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.createdAt - b.createdAt; // Oldest first for same priority
    });
}

/**
 * Aggregates both Tracker-based and Simulated agents
 */
function aggregateAllAgents() {
    const agents = [];

    // 1. Live Technicians (from tracker data)
    if (AppState.team && AppState.team.members) {
        AppState.team.members.forEach(member => {
            // Find current position if available
            const pos = AppState.trackerPositions?.find(p => p.attributes?.name === member.name || p.deviceId === member.id);
            
            let status = "Offline";
            if (pos) {
                // Determine status with some hysteresis/memory
                const prevStatus = member.lastStatus;
                const currentSpeed = pos.speed || 0;
                
                if (currentSpeed > 10) {
                    status = "En Route";
                } else if (currentSpeed <= 10 && prevStatus === "En Route") {
                    // Slowing down, but maybe not quite onsite yet
                    status = "On Site";
                } else if (prevStatus === "On Site") {
                    // Prevent state reversion: stay onsite unless moving fast
                    status = currentSpeed > 15 ? "En Route" : "On Site";
                } else {
                    status = currentSpeed > 5 ? "En Route" : "On Site";
                }
                member.lastStatus = status;
            }

            agents.push({
                ...member,
                isLive: true,
                status: status,
                taskCount: AppState.tasks?.filter(t => String(t.assignee || t.assignee_id) === String(member.id)).length || 0,
                color: member.color || "#10b981"
            });
        });
    }

    // 2. Simulated Agents
    if (AppState.simulation.active) {
        AppState.simulation.agents.forEach(agent => {
            agents.push({
                ...agent,
                isLive: false,
                taskCount: agent.taskQueue?.length || 0,
                status: agent.status || "Idle"
            });
        });
    }

    return agents;
}

/**
 * Update Top Strip Metrics (ISP Heartbeat)
 */
function updateHeartbeatMetrics(allTasks, allAgents) {
    const hbNetworkHealth = document.getElementById("hbNetworkHealth");
    const hbOpenTickets = document.getElementById("hbOpenTickets");
    const hbCriticalTasks = document.getElementById("hbCriticalTasks");
    const hbActiveTechs = document.getElementById("hbActiveTechs");

    if (!hbNetworkHealth || !hbOpenTickets || !hbCriticalTasks || !hbActiveTechs) return;

    // 1. Network Health
    let healthPct = 100;
    if (AppState.towers && AppState.towers.length > 0) {
        let criticalTowers = 0;
        Object.values(AppState.nagiosStatus).forEach(status => {
            if (status.overallStatus === "CRITICAL" || status.overallStatus === "DOWN") criticalTowers++;
        });
        if (AppState.simulation.active) criticalTowers += AppState.simulation.outages?.length || 0;
        
        healthPct = Math.max(0, Math.floor(((AppState.towers.length - criticalTowers) / AppState.towers.length) * 100));
        hbNetworkHealth.textContent = `${healthPct}%`;
        hbNetworkHealth.className = `text-2xl font-black ${healthPct > 90 ? 'text-emerald-600' : healthPct > 70 ? 'text-amber-500' : 'text-red-600'}`;
    }

    // 2. Open Tickets
    const openCount = allTasks.length;
    hbOpenTickets.textContent = openCount;

    // 3. Critical Priority (excluding Legacy > 30d)
    const now = Date.now();
    const criticalCount = allTasks.filter(t => {
        const ageDays = (now - t.createdAt) / (1000 * 3600 * 24);
        if (ageDays > 30) return false; // Legacy exclusion
        return t.priority.toLowerCase() === "critical" || t.priority.toLowerCase() === "high";
    }).length;
    hbCriticalTasks.textContent = criticalCount;

    if (!AppState.metricsHistory) AppState.metricsHistory = { openTickets: [], critical: [] };
    AppState.metricsHistory.openTickets.push(openCount);
    if (AppState.metricsHistory.openTickets.length > 20) AppState.metricsHistory.openTickets.shift();
    const prevOpen = AppState.metricsHistory.openTickets.length > 1 ? AppState.metricsHistory.openTickets[AppState.metricsHistory.openTickets.length - 2] : null;
    const openTrendEl = document.getElementById('hbOpenTicketsTrend');
    if (openTrendEl) {
        if (prevOpen == null) {
            openTrendEl.textContent = '';
            openTrendEl.className = 'text-[10px] font-black text-slate-400 mt-0.5 flex items-center gap-1';
        } else {
            const delta = openCount - prevOpen;
            let cls = 'text-[10px] font-black mt-0.5 flex items-center gap-1 ';
            if (delta > 0) { cls += 'text-red-600'; openTrendEl.textContent = `▲ +${delta}`; }
            else if (delta < 0) { cls += 'text-emerald-600'; openTrendEl.textContent = `▼ ${Math.abs(delta)}`; }
            else { cls += 'text-slate-400'; openTrendEl.textContent = '— 0'; }
            openTrendEl.className = cls;
        }
    }

    AppState.metricsHistory.critical.push(criticalCount);
    if (AppState.metricsHistory.critical.length > 20) AppState.metricsHistory.critical.shift();
    const prevCrit = AppState.metricsHistory.critical.length > 1 ? AppState.metricsHistory.critical[AppState.metricsHistory.critical.length - 2] : null;
    const critTrendEl = document.getElementById('hbCriticalTasksTrend');
    if (critTrendEl) {
        if (prevCrit == null) {
            critTrendEl.textContent = '';
            critTrendEl.className = 'text-[10px] font-black text-slate-400 mt-0.5 flex items-center gap-1';
        } else {
            const delta = criticalCount - prevCrit;
            let cls = 'text-[10px] font-black mt-0.5 flex items-center gap-1 ';
            if (delta > 0) { cls += 'text-red-600'; critTrendEl.textContent = `▲ +${delta}`; }
            else if (delta < 0) { cls += 'text-emerald-600'; critTrendEl.textContent = `▼ ${Math.abs(delta)}`; }
            else { cls += 'text-slate-400'; critTrendEl.textContent = '— 0'; }
            critTrendEl.className = cls;
        }
    }

    // 4. Active Techs
    hbActiveTechs.textContent = allAgents.filter(a => a.status !== "Offline").length;
    
    // Update Badge counts if present
    const dashAgentCount = document.getElementById("dashAgentCount");
    const dashTaskCount = document.getElementById("dashTaskCount");
    if (dashAgentCount) dashAgentCount.textContent = `${allAgents.length} Agents`;
    if (dashTaskCount) dashTaskCount.textContent = `${allTasks.length} Tasks`;

    const openCard = document.getElementById('hbOpenTickets') ? document.getElementById('hbOpenTickets').closest('.heartbeat-stat') : null;
    const critCard = document.getElementById('hbCriticalTasks') ? document.getElementById('hbCriticalTasks').closest('.heartbeat-stat') : null;
    [openCard, critCard].forEach(c => { if (c) { c.classList.remove('ring-2','ring-primary-500','bg-primary-50'); } });
    if (AppState.activeMetricFilter === 'open' && openCard) { openCard.classList.add('ring-2','ring-primary-500','bg-primary-50'); }
    if (AppState.activeMetricFilter === 'critical' && critCard) { critCard.classList.add('ring-2','ring-primary-500','bg-primary-50'); }
}

/**
 * Update Technician Workload Grid
 */
function updateTechnicianGrid(agents) {
    const listContainer = document.getElementById("dashAgentList");
    if (!listContainer) return;

    if (agents.length === 0) {
        listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <i data-lucide="user-minus" class="w-10 h-10 mb-2 opacity-20"></i>
                <p class="text-sm font-medium">No active technicians</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    listContainer.innerHTML = "";
    
    agents.forEach(agent => {
        const color = agent.color || "#3b82f6";
        const workload = agent.taskCount;
        const maxCap = AppState.simulation.maxTasksPerAgent || 10;
        const progress = Math.min((workload / maxCap) * 100, 100);
        const progressColor = workload > (maxCap * 0.8) ? "bg-red-600" : workload > (maxCap * 0.5) ? "bg-amber-500" : "bg-emerald-500";

        const card = document.createElement("div");
        const animationClass = AppState.dashboardOpening ? "animate__animated animate__fadeInUp" : "animate__animated animate__fadeIn animate__faster";
        card.className = `p-5 bg-white rounded-2xl border ${AppState.activeTargetTechId === agent.id ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/30' : 'border-slate-100'} shadow-sm hover:border-primary-300 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden ${animationClass} tech-grid-item drop-target`;
        card.dataset.agentId = agent.id;
        card.dataset.isLive = agent.isLive;

        card.onclick = (e) => {
            // Click to set as active target for bulk assignment
            if (AppState.activeTargetTechId === agent.id) {
                AppState.activeTargetTechId = null;
            } else {
                AppState.activeTargetTechId = agent.id;
            }
            updateOperationalDashboard();
            
            // Pan to agent if not choosing for assignment
            if (!AppState.activeTargetTechId && agent.marker) {
                AppState.map.panTo(agent.marker.getPosition());
                AppState.map.setZoom(16);
            }
        };

        // Drag & Drop Handlers
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('border-primary-500', 'bg-primary-50/50', 'ring-2', 'ring-primary-500/20');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('border-primary-500', 'bg-primary-50/50', 'ring-2', 'ring-primary-500/20');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('border-primary-500', 'bg-primary-50/50', 'ring-2', 'ring-primary-500/20');
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                handleTaskAssignment(data.taskId, agent.id, agent.isLive);
            } catch (err) {
                console.error("Drop failed:", err);
            }
        });
        // ETC Logic for simulation
        let etcHtml = "";
        if (!agent.isLive && agent.status === "On Site" && agent.workStartedAt && agent.expectedWorkDuration) {
            const elapsed = Date.now() - agent.workStartedAt;
            const remaining = Math.max(0, agent.expectedWorkDuration - elapsed);
            const remainingMin = Math.ceil(remaining / (60 * 1000));
            const workProgress = Math.min((elapsed / agent.expectedWorkDuration) * 100, 100);
            
            etcHtml = `
                <div class="mt-5 pt-4 border-t border-slate-50">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                            <span class="relative flex h-2.5 w-2.5">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            On-Site Repair
                        </div>
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            ≈${remainingMin}m Left
                        </div>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                        <div class="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.4)]" style="width: ${workProgress}%"></div>
                    </div>
                </div>
            `;
        } else if (agent.isLive && agent.status === "On Site") {
            etcHtml = `
                <div class="mt-4 py-2.5 px-4 bg-emerald-50 rounded-xl text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-3 border border-emerald-100">
                    <span class="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Field Operations
                </div>
            `;
        } else if (agent.status === "En Route") {
             etcHtml = `
                <div class="mt-4 text-[10px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-2 px-1" title="In Transit">
                    <div class="p-1.5 bg-primary-50 rounded-lg">
                        <i data-lucide="truck" class="w-4 h-4 animate-bounce"></i> 
                    </div>
                    In Transit
                </div>
            `;
        }

        let tagsHtml = '';
        const skills = Array.isArray(agent.skills) ? agent.skills.slice(0, 3) : [];
        const regionTag = agent.region || agent.area;
        const tagSpans = [];
        skills.forEach(s => { if (s) tagSpans.push(`<span class=\"text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200\">${String(s)}</span>`); });
        if (regionTag) { tagSpans.push(`<span class=\"text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 border border-primary-100\">${String(regionTag)}</span>`); }
        if (tagSpans.length) { tagsHtml = `<div class=\"flex flex-wrap gap-1 mt-2\">${tagSpans.join('')}</div>`; }
        card.innerHTML = `
            <div class="flex justify-between items-start mb-5">
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all group-hover:scale-110 group-hover:rotate-3" style="background-color: ${color}">
                            <i data-lucide="${agent.isLive ? 'user' : 'navigation'}" class="w-7 h-7"></i>
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-md ${agent.isLive ? 'bg-emerald-500' : 'bg-blue-500'}"></div>
                    </div>
                    <div>
                        <div class="font-black text-slate-800 truncate max-w-[140px] leading-tight text-base tracking-tight">${agent.name}</div>
                        <div class="flex items-center gap-2 mt-2">
                            <span class="text-[9px] font-black uppercase px-2 py-1 rounded-md bg-slate-100 text-slate-500 border border-slate-200 shadow-sm">
                                ${agent.seniority || 'Tech'}
                            </span>
                            ${agent.isLive ? '<span class="text-[9px] font-black uppercase px-2 py-1 rounded-md bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-sm">Live</span>' : ''}
                        </div>
                        ${tagsHtml}
                    </div>
                </div>
                <div class="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-center min-w-[50px]">
                    <div class="text-base font-black text-slate-800 leading-none">${workload}</div>
                    <div class="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Tasks</div>
                </div>
            </div>
            
            <div class="space-y-2 px-1">
                <div class="flex justify-between items-center text-[10px] font-black">
                    <span class="text-slate-400 uppercase tracking-widest">${agent.status}</span>
                    <span class="text-slate-600">${Math.round(progress)}% Load</span>
                </div>
                <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner p-0.5">
                    <div class="h-full ${progressColor} transition-all duration-1000 rounded-full" style="width: ${progress}%"></div>
                </div>
            </div>
            
            ${etcHtml}
        `;
        
        listContainer.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Update Firefighting / Priority Queue
 */
function updatePriorityTaskQueue(tasks) {
    const listContainer = document.getElementById("dashTaskList");
    const bulkBar = document.getElementById("bulkAssignmentBar");
    const selectedCountSpan = document.getElementById("selectedTaskCount");
    const targetTechNameSpan = document.getElementById("targetTechName");
    
    if (!listContainer) return;

    const filtersBar = document.getElementById('dashFiltersBar');
    if (filtersBar) {
        const existing = document.getElementById('metricFilterChip');
        if (existing) existing.remove();
        if (AppState.activeMetricFilter) {
            const chip = document.createElement('button');
            chip.id = 'metricFilterChip';
            chip.className = 'px-2 py-1 text-[10px] font-black rounded-lg border border-primary-200 bg-primary-50 text-primary-700 flex items-center gap-1';
            chip.innerHTML = (AppState.activeMetricFilter === 'open' ? 'Metric: Open Tickets' : 'Metric: Critical Priority') + ' <span class="ml-1">✕</span>';
            chip.onclick = (e) => {
                e.preventDefault();
                if (AppState.activeMetricFilter === 'open') {
                    AppState.taskFilters.status = 'all';
                    const fStatusEl = document.getElementById('dashTaskStatusFilter');
                    if (fStatusEl) fStatusEl.value = 'all';
                } else if (AppState.activeMetricFilter === 'critical') {
                    AppState.taskFilters.priorities = { critical: true, high: true, medium: true, low: true };
                    const fPriCriticalEl = document.getElementById('fPriCritical');
                    const fPriHighEl = document.getElementById('fPriHigh');
                    const fPriMediumEl = document.getElementById('fPriMedium');
                    const fPriLowEl = document.getElementById('fPriLow');
                    if (fPriCriticalEl) fPriCriticalEl.checked = true;
                    if (fPriHighEl) fPriHighEl.checked = true;
                    if (fPriMediumEl) fPriMediumEl.checked = true;
                    if (fPriLowEl) fPriLowEl.checked = true;
                }
                AppState.activeMetricFilter = null;
                try { localStorage.setItem('belanet_task_filters_v1', JSON.stringify(AppState.taskFilters)); } catch(_) {}
                updateOperationalDashboard();
            };
            filtersBar.appendChild(chip);
        }
    }

    if (tasks.length === 0) {
        const liveLoaded = Array.isArray(AppState.tasks);
        const simHas = Array.isArray(AppState.simulation?.tasks) && AppState.simulation.tasks.length > 0;
        if (!liveLoaded && !simHas) {
            listContainer.innerHTML = '<div class="flex flex-col items-center justify-center py-10 text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200"><i data-lucide="inbox" class="w-10 h-10 mb-2 opacity-20"></i><p class="text-sm font-medium">No tasks loaded yet</p><p class="text-[11px] text-slate-400 mt-1">Waiting for task data...</p></div>';
        } else {
            listContainer.innerHTML = '<div class="text-center py-10 text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">No active tasks found</div>';
        }
        if (bulkBar) bulkBar.classList.add("hidden");
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // Build dynamic filter options for Status and Customer
    const statusSel = document.getElementById('dashTaskStatusFilter');
    const customerSel = document.getElementById('dashTaskCustomerFilter');
    const uniqueStatuses = Array.from(new Set(tasks.map(t => (t.status || 'Open')))).sort();
    const uniqueCustomers = Array.from(new Set(tasks.map(t => t.customer || 'Unknown Customer'))).sort();
    if (statusSel) {
        const current = AppState.taskFilters?.status || 'all';
        statusSel.innerHTML = '<option value="all">All Statuses</option>' + uniqueStatuses.map(s => `<option value="${s.toLowerCase()}">${s}</option>`).join('');
        statusSel.value = current;
    }
    if (customerSel) {
        const currentC = AppState.taskFilters?.customer || 'all';
        customerSel.innerHTML = '<option value="all">All Customers</option>' + uniqueCustomers.map(c => `<option value="${encodeURIComponent(c)}">${c}</option>`).join('');
        customerSel.value = currentC;
    }

    // Apply Combined Filters
    const searchQuery = document.getElementById("dashTaskSearch")?.value.toLowerCase() || "";
    const tf = AppState.taskFilters || { priorities: { critical: true, high: true, medium: true, low: true }, status: 'all', customer: 'all', age: 'all', unassignedOnly: false, sort: 'urgent' };
    const now = Date.now();

    let filteredTasks = tasks.filter(t => {
        const matchesSearch = !searchQuery || 
            (t.customer && t.customer.toLowerCase().includes(searchQuery)) || 
            (t.title && t.title.toLowerCase().includes(searchQuery)) || 
            (t.id && t.id.toString().toLowerCase().includes(searchQuery));

        const p = (t.priority || 'medium').toLowerCase();
        const matchesPriority = !!tf.priorities[p];

        const s = (t.status || 'open').toLowerCase();
        const matchesStatus = tf.status === 'all' || s === tf.status;

        const matchesCustomer = tf.customer === 'all' || encodeURIComponent(t.customer || '') === tf.customer;

        const ageHours = (now - t.createdAt) / (1000 * 3600);
        let matchesAge = true;
        if (tf.age === 'today') matchesAge = ageHours < 24;
        else if (tf.age === '24h') matchesAge = ageHours >= 24 && ageHours < 48;
        else if (tf.age === '48h') matchesAge = ageHours >= 48;

        let isAssigned = false;
        if (!t.isLive) {
            const assignedAgent = AppState.simulation.agents?.find(a => a.taskQueue && a.taskQueue.some(tt => tt.id === t.id));
            isAssigned = !!assignedAgent;
        } else {
            isAssigned = !!t.assigneeId;
        }
        const matchesUnassigned = !tf.unassignedOnly || !isAssigned;

        return matchesSearch && matchesPriority && matchesStatus && matchesCustomer && matchesAge && matchesUnassigned;
    });

    if (filteredTasks.length === 0) {
        listContainer.innerHTML = '<div class="flex flex-col items-center justify-center py-10 text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200"><i data-lucide="filter-x" class="w-10 h-10 mb-2 opacity-20"></i><p class="text-sm font-medium">No tasks match current filters</p><button id="resetTaskFiltersBtn" class="mt-3 px-3 py-1.5 text-[11px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Clear Filters</button></div>';
        if (bulkBar) bulkBar.classList.add('hidden');
        if (window.lucide) window.lucide.createIcons();
        const btn = document.getElementById('resetTaskFiltersBtn');
        if (btn) btn.onclick = (e) => {
            e.preventDefault();
            AppState.activeMetricFilter = null;
            AppState.taskFilters = { priorities: { critical: true, high: true, medium: true, low: true }, status: 'all', customer: 'all', age: 'all', unassignedOnly: false, sort: 'urgent' };
            try { localStorage.setItem('belanet_task_filters_v1', JSON.stringify(AppState.taskFilters)); } catch(_){ }
            updateOperationalDashboard();
        };
        return;
    }

    // Attach ageDays for legacy highlighting
    const withAge = filteredTasks.map(t => ({ ...t, ageDays: (now - t.createdAt) / (1000 * 3600 * 24) }));

    // Sorting Presets
    let sortedTasks;
    if (tf.sort === 'oldest') {
        sortedTasks = withAge.sort((a, b) => a.createdAt - b.createdAt);
    } else if (tf.sort === 'unassigned') {
        sortedTasks = withAge.sort((a, b) => {
            const aAssigned = (a.isLive ? !!a.assigneeId : (AppState.simulation.agents?.some(x => x.taskQueue?.some(tt => tt.id === a.id)) || false)) ? 1 : 0;
            const bAssigned = (b.isLive ? !!b.assigneeId : (AppState.simulation.agents?.some(x => x.taskQueue?.some(tt => tt.id === b.id)) || false)) ? 1 : 0;
            if (aAssigned !== bAssigned) return aAssigned - bAssigned; // unassigned first
            return a.createdAt - b.createdAt;
        });
    } else {
        sortedTasks = withAge.map(t => {
            const ageHours = (now - t.createdAt) / (1000 * 3600);
            let score = ageHours * 0.5;
            const pl = (t.priority || '').toLowerCase();
            if (pl === 'critical') score += 100;
            else if (pl === 'high') score += 50;
            if (t.isBusiness || (t.customer && t.customer.toLowerCase().includes('business'))) score += 30;
            return { ...t, urgencyScore: score };
        }).sort((a, b) => b.urgencyScore - a.urgencyScore);
    }

    // Grid Layout
    const cols = AppState.dashboardGridCols || 2;
    listContainer.className = `p-6 grid gap-4 flex-1 overflow-y-auto custom-scrollbar`;
    listContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    listContainer.style.alignContent = "start";

    // Update Bulk Bar
    if (bulkBar) {
        if (AppState.activeTargetTechId && AppState.selectedTasks.size > 0) {
            bulkBar.classList.remove("hidden");
            selectedCountSpan.innerText = AppState.selectedTasks.size;
            const tech = aggregateAllAgents().find(a => a.id === AppState.activeTargetTechId);
            targetTechNameSpan.innerText = tech?.name || "Unknown";
        } else {
            bulkBar.classList.add("hidden");
        }
    }

    listContainer.innerHTML = "";

    sortedTasks.forEach(task => {
        const isLegacy = task.ageDays > 30;
        const isSim = !task.isLive;
        const isSelected = AppState.selectedTasks.has(String(task.id));
        
        // Find assigned agent
        let assignedAgent = null;
        if (isSim) {
            assignedAgent = AppState.simulation.agents.find(a => 
                a.taskQueue && a.taskQueue.some(t => t.id === task.id)
            );
        }

        const pLow = task.priority.toLowerCase();
        const urgencyClass = `urgency-${pLow}`;
        const isAssigned = !!assignedAgent || !!task.assigneeId;
        const isExpanded = AppState.expandedTasks && AppState.expandedTasks.has(String(task.id));

        // Skill Matching Validation
        const taskSkills = task.requiredSkills || (task.requiredSkill ? [task.requiredSkill] : []);
        const allAgents = aggregateAllAgents();
        const hasMatchingTech = taskSkills.length === 0 || allAgents.some(a => 
            a.skills && taskSkills.every(s => a.skills.includes(s))
        );
        
        const card = document.createElement("div");
        const animationClass = AppState.dashboardOpening ? "animate__animated animate__fadeInRight" : "animate__animated animate__fadeIn animate__faster";
        card.className = `p-4 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${animationClass} h-[140px] ${urgencyClass} ${
            isSelected ? 'ring-2 ring-primary-500 border-primary-500 bg-primary-50/50' : 
            isAssigned ? 'bg-slate-50/50 border-slate-100 opacity-80' : 
            !hasMatchingTech ? 'bg-red-50/30 border-red-200' :
            isLegacy ? 'bg-purple-50/30 border-purple-100' : 'bg-white/80 border-slate-100'
        } hover:shadow-lg backdrop-blur-md task-dashboard-card ${isAssigned ? 'assigned' : ''}`;
        card.dataset.taskId = task.id;
        card.draggable = !isAssigned;
        if (isExpanded) card.classList.add('expanded');
        card.style.transition = 'max-height 200ms ease';
        const isCompactDensity = (AppState.dashboardDensity === 'compact');
        const collapsedH = isCompactDensity ? '140px' : '160px';
        const expandedH = isCompactDensity ? '320px' : '360px';
        card.style.maxHeight = isExpanded ? expandedH : collapsedH;
        
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, isLive: task.isLive }));
            card.classList.add('opacity-40');
        });

        card.onclick = (e) => {
            if (AppState.activeTargetTechId && !isAssigned) {
                if (isSelected) AppState.selectedTasks.delete(String(task.id));
                else AppState.selectedTasks.add(String(task.id));
                updateOperationalDashboard();
                return;
            }
            
            // Default click: center on map
            const customerObj = task.customerObj || (task.isLive && AppState.customerById[task.related_customer_id || task.customer_id]);
            if (customerObj && customerObj.gps) {
                const parts = customerObj.gps.split(',').map(Number);
                if (parts.length === 2) {
                    AppState.map.setCenter({ lat: parts[0], lng: parts[1] });
                    AppState.map.setZoom(17);
                    document.getElementById("taskDashboard").classList.add("hidden");
                    const markerData = AppState.customerMarkers?.find(m => m.customer.id === customerObj.id);
                    if (markerData && typeof showCustomerInfoWindow === 'function') showCustomerInfoWindow(markerData);
                }
            }
        };

        const priorityColors = { "critical": "bg-red-600 text-white", "high": "bg-amber-200 text-amber-800", "medium": "bg-slate-200 text-slate-700", "low": "bg-slate-100 text-slate-600" };
        const pColor = priorityColors[pLow] || "bg-slate-100 text-slate-600";
        const ageMs = now - task.createdAt;
        const ageMinutes = Math.floor(ageMs / (60 * 1000));
        let ageLabel = '';
        if (ageMinutes < 60) {
            ageLabel = `${ageMinutes}m`;
        } else if (ageMinutes < 60 * 24) {
            ageLabel = `${Math.floor(ageMinutes / 60)}h`;
        } else {
            ageLabel = `${Math.floor(ageMinutes / (60 * 24))}d`;
        }
        const slaCfg = AppState.slaConfig || { amberHours: 8, redHours: 24 };
        const ageHours = ageMinutes / 60;
        const slaClass = ageHours >= slaCfg.redHours ? 'sla-red' : ageHours >= slaCfg.amberHours ? 'sla-amber' : 'sla-green';
        const slaTitle = ageHours >= slaCfg.redHours ? 'SLA Risk' : ageHours >= slaCfg.amberHours ? 'Approaching SLA' : 'Low Risk';

        // Status / Action Button
        let actionHtml = "";
        if (assignedAgent && assignedAgent.status === "On Site" && assignedAgent.taskQueue[0]?.id === task.id) {
            actionHtml = `
                <button onclick="event.stopPropagation(); completeTaskExplicitly('${task.id}', '${assignedAgent.id}')" class="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-emerald-700 shadow-sm transition-all">
                    Complete Task
                </button>
            `;
        } else if (isAssigned) {
            actionHtml = `<span class="text-[8px] font-black text-slate-400 uppercase">Assigned: ${assignedAgent.name}</span>`;
        }

        const simBadge = isSim ? `
            <span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[7px] font-black uppercase">Sim</span>
        ` : '';
        const matchBadge = !hasMatchingTech ? `
            <span class="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[7px] font-black uppercase">No Matching Tech</span>
        ` : '';

        const updatedAtMs = task.updatedAt || task.createdAt;
        const updatedMin = Math.floor((now - updatedAtMs) / (60 * 1000));
        let updatedAgo = '';
        if (updatedMin < 60) { updatedAgo = `${updatedMin}m`; }
        else if (updatedMin < 60 * 24) { updatedAgo = `${Math.floor(updatedMin / 60)}h`; }
        else { updatedAgo = `${Math.floor(updatedMin / (60 * 24))}d`; }
        const assignedLabel = isAssigned ? `Assigned to ${assignedAgent.name}` : 'Unassigned';
        const detailText = String(task.Description || task.description || task.details || task.title || '');

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100" title="${task.isLive ? 'Live Task' : 'Simulated Task'}">
                        <i data-lucide="${task.isLive ? 'globe' : 'cpu'}" class="w-5 h-5"></i>
                    </div>
                    <div class="overflow-hidden">
                        <div class="text-sm font-black text-slate-800 leading-tight truncate w-full">${task.customer}</div>
                        <div class="text-[9px] font-bold text-slate-400 tracking-tight secondary-label">#${task.id.toString().split('-')[0]}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="priority-badge px-3 py-1.5 rounded-lg text-[11px] font-black ${pColor} uppercase shadow-md" title="Priority: ${task.priority}">${task.priority}</div>
                    <button class="task-expand-btn px-1.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50" title="${isExpanded ? 'Collapse' : 'Expand'}">
                        <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            
            <div class="flex-1 my-2 overflow-hidden">
                <div class="text-[10px] font-black text-slate-500 line-clamp-2">${task.title}</div>
                <div class="mt-1 flex items-center gap-2"><span class="sla-dot ${slaClass}" title="${slaTitle}"></span><span class="task-age-badge">Opened ${ageLabel} ago</span></div>
            </div>

            <div class="task-expanded-content ${isExpanded ? '' : 'hidden'} mt-2 pt-2 border-t border-slate-100">
                <div class="text-xs font-semibold text-slate-700 break-words">${detailText}</div>
                <div class="mt-2 text-[10px] font-black text-slate-500 flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">Updated ${updatedAgo} ago</span>
                    <span class="px-2 py-0.5 rounded ${isAssigned ? 'bg-slate-100 border border-slate-200' : 'bg-amber-50 border border-amber-200 text-amber-600'}">${assignedLabel}</span>
                </div>
            </div>

            <div class="flex justify-between items-center pt-2 border-t border-slate-100">
                <div class="flex gap-1">
                    ${simBadge}
                    ${matchBadge}
                    ${task.isBusiness ? '<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[7px] font-black uppercase">Biz</span>' : ''}
                </div>
                ${actionHtml}
            </div>
        `;
        
        const expandBtn = card.querySelector('.task-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idStr = String(task.id);
                if (AppState.expandedTasks && AppState.expandedTasks.has(idStr)) AppState.expandedTasks.delete(idStr);
                else {
                    if (!AppState.expandedTasks) AppState.expandedTasks = new Set();
                    AppState.expandedTasks.add(idStr);
                }
                updateOperationalDashboard();
            });
        }
        
        listContainer.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Explicitly completes a task
 */
function completeTaskExplicitly(taskId, agentId) {
    if (typeof markTaskCompleted === 'function') {
        markTaskCompleted(taskId, agentId);
        showNotification("Task Complete", `Task ${taskId} has been marked as COMPLETED.`, "success");
        updateOperationalDashboard();
    } else {
        // Fallback for simulation
        const agent = AppState.simulation.agents.find(a => a.id === agentId);
        if (agent && agent.taskQueue[0]?.id === taskId) {
            agent.status = "Idle";
            if (!agent.stats) agent.stats = { completedTasks: [] };
            agent.stats.completedTasks.push(taskId);
            agent.taskQueue.shift();
            showNotification("Task Complete", `Task ${taskId} finished.`, "success");
            updateOperationalDashboard();
        }
    }
}

// Global alias
window.completeTaskExplicitly = completeTaskExplicitly;
