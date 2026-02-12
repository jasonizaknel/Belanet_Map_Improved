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
    const dashPriority = document.getElementById("dashTaskPriorityFilter");
    const toggleGridView = document.getElementById("toggleTaskGridViewBtn");

    if (dashSearch) {
        dashSearch.addEventListener("input", () => updateOperationalDashboard());
    }
    if (dashPriority) {
        dashPriority.addEventListener("change", () => updateOperationalDashboard());
    }
    if (toggleGridView) {
        toggleGridView.addEventListener("click", () => {
            AppState.dashboardGridView = !AppState.dashboardGridView;
            toggleGridView.classList.toggle("bg-primary-100", AppState.dashboardGridView);
            toggleGridView.classList.toggle("text-primary-600", AppState.dashboardGridView);
            updateOperationalDashboard();
        });
    }

    // Initialize new AppState variables
    if (!AppState.dashboardGridCols) AppState.dashboardGridCols = 2;
    if (!AppState.selectedTasks) AppState.selectedTasks = new Set();
    if (!AppState.activeTargetTechId) AppState.activeTargetTechId = null;

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
                    createdAt: new Date(t.date_created || t.created_at || Date.now()).getTime()
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
    hbOpenTickets.textContent = allTasks.length;

    // 3. Critical Priority (excluding Legacy > 30d)
    const now = Date.now();
    const criticalCount = allTasks.filter(t => {
        const ageDays = (now - t.createdAt) / (1000 * 3600 * 24);
        if (ageDays > 30) return false; // Legacy exclusion
        return t.priority.toLowerCase() === "critical" || t.priority.toLowerCase() === "high";
    }).length;
    hbCriticalTasks.textContent = criticalCount;

    // 4. Active Techs
    hbActiveTechs.textContent = allAgents.filter(a => a.status !== "Offline").length;
    
    // Update Badge counts if present
    const dashAgentCount = document.getElementById("dashAgentCount");
    const dashTaskCount = document.getElementById("dashTaskCount");
    if (dashAgentCount) dashAgentCount.textContent = `${allAgents.length} Agents`;
    if (dashTaskCount) dashTaskCount.textContent = `${allTasks.length} Tasks`;
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
                <div class="mt-4 text-[10px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-2 px-1">
                    <div class="p-1.5 bg-primary-50 rounded-lg">
                        <i data-lucide="truck" class="w-4 h-4 animate-bounce"></i> 
                    </div>
                    In Transit
                </div>
            `;
        }

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

    if (tasks.length === 0) {
        listContainer.innerHTML = '<div class="text-center py-10 text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">No active tasks found</div>';
        if (bulkBar) bulkBar.classList.add("hidden");
        return;
    }

    // Apply Search and Priority Filters
    const searchQuery = document.getElementById("dashTaskSearch")?.value.toLowerCase() || "";
    const priorityFilter = document.getElementById("dashTaskPriorityFilter")?.value || "all";
    
    let filteredTasks = tasks.filter(t => {
        const matchesSearch = !searchQuery || 
            t.customer.toLowerCase().includes(searchQuery) || 
            t.title.toLowerCase().includes(searchQuery) || 
            t.id.toString().toLowerCase().includes(searchQuery);
        
        const matchesPriority = priorityFilter === "all" || t.priority.toLowerCase() === priorityFilter;
        
        return matchesSearch && matchesPriority;
    });

    // Calculate Urgency Score
    const now = Date.now();
    const sortedTasks = filteredTasks.map(t => {
        const ageHours = (now - t.createdAt) / (1000 * 3600);
        let score = ageHours * 0.5;
        const p = t.priority.toLowerCase();
        if (p === "critical") score += 100;
        else if (p === "high") score += 50;
        if (t.isBusiness || (t.customer && t.customer.toLowerCase().includes("business"))) score += 30;
        return { ...t, urgencyScore: score, ageDays: ageHours / 24 };
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore);

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
        const isAssigned = !!assignedAgent;

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

        const priorityColors = { "critical": "bg-red-500", "high": "bg-orange-500", "medium": "bg-blue-500", "low": "bg-slate-400" };
        const pColor = priorityColors[pLow] || "bg-slate-400";
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
            <span class="px-1.5 py-0.5 rounded bg-indigo-500 text-white text-[7px] font-black uppercase">Sim</span>
        ` : '';
        const matchBadge = !hasMatchingTech ? `
            <span class="px-1.5 py-0.5 rounded bg-red-600 text-white text-[7px] font-black uppercase animate-pulse">No Matching Tech</span>
        ` : '';

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                        <i data-lucide="${task.isLive ? 'globe' : 'cpu'}" class="w-5 h-5"></i>
                    </div>
                    <div class="overflow-hidden">
                        <div class="text-sm font-black text-slate-800 leading-tight truncate w-full">${task.customer}</div>
                        <div class="text-[9px] font-bold text-slate-400 tracking-tight secondary-label">#${task.id.toString().split('-')[0]}</div>
                    </div>
                </div>
                <div class="priority-badge px-3 py-1.5 rounded-lg text-[11px] font-black text-white ${pColor} uppercase shadow-md">${task.priority}</div>
            </div>
            
            <div class="flex-1 my-2 overflow-hidden">
                <div class="text-[10px] font-black text-slate-500 line-clamp-2">${task.title}</div>
                <div class="mt-1"><span class="task-age-badge">Opened ${ageLabel} ago</span></div>
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
