/**
 * Playground Mode / Simulation Logic
 */

function getCoords(obj) {
    if (!obj) return null;
    if (obj.lat && obj.lng) return { lat: obj.lat, lng: obj.lng };
    if (obj.gps && typeof obj.gps === 'string' && obj.gps.includes(',')) {
        const parts = obj.gps.split(',');
        return {
            lat: parseFloat(parts[0]),
            lng: parseFloat(parts[1])
        };
    }
    return null;
}

let simulationInterval = null;
let markerUpdateInterval = null;
let directionsService = null;
let distanceMatrixService = null;
const OFFICE_LOCATION = { lat: -24.882502, lng: 28.283867 }; // 76 Moffat Street, Bela Bela (Corrected)
const SIM_SKILLS = ['fiber', 'wireless', 'tower_climbing', 'cctv', 'voip'];
const SKILL_COLORS = {
    'fiber': 200,      // Blue
    'wireless': 120,   // Green
    'tower_climbing': 15, // Red/Orange
    'cctv': 280,       // Purple
    'voip': 180        // Cyan
};
const SENIORITY_LEVELS = ['Junior', 'Intermediate', 'Senior', 'Lead'];
const SIM_PARTS = ['router', 'cable_cat6', 'poe_injector', 'radio_ubnt', 'radio_mikrotik'];

let simulationUIInitialized = false;
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function adjustColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function generate64Colors() {
    const colors = [];
    for (let i = 0; i < 64; i++) {
        // Distribute hues evenly
        const hue = (i * 360) / 64;
        // Vary saturation and lightness for variety
        const saturation = 70 + (i % 2) * 15;
        const lightness = 45 + (Math.floor(i / 8) % 2) * 10;
        colors.push(hslToHex(hue, saturation, lightness));
    }
    return colors;
}

let editingAgent = null;

function initAgentCustomizationUI() {
    const editModal = document.getElementById("editAgentModal");
    const nameInput = document.getElementById("editAgentName");
    const colorDisplay = document.getElementById("currentColorDisplay");
    const openPaletteBtn = document.getElementById("openPaletteBtn");
    const saveBtn = document.getElementById("saveEditAgentBtn");
    const cancelBtn = document.getElementById("cancelEditAgentBtn");
    const palettePopup = document.getElementById("colorPalettePopup");
    const colorGrid = document.getElementById("colorGrid");
    const closePaletteBtn = document.getElementById("closePaletteBtn");

    if (!editModal) return;

    // Generate Palette
    const colors = generate64Colors();
    colorGrid.innerHTML = "";
    colors.forEach(color => {
        const swatch = document.createElement("div");
        swatch.className = "color-swatch";
        swatch.style.backgroundColor = color;
        swatch.title = color;
        swatch.onclick = () => {
            colorDisplay.style.backgroundColor = color;
            colorDisplay.dataset.color = color;
            palettePopup.style.display = "none";
        };
        colorGrid.appendChild(swatch);
    });

    openPaletteBtn.onclick = (e) => {
        const rect = openPaletteBtn.getBoundingClientRect();
        palettePopup.style.top = `${rect.bottom + 10}px`;
        palettePopup.style.left = `${rect.left}px`;
        palettePopup.style.display = "block";
        e.stopPropagation();
    };

    closePaletteBtn.onclick = () => {
        palettePopup.style.display = "none";
    };

    document.addEventListener("click", (e) => {
        if (palettePopup.style.display === "block" && !palettePopup.contains(e.target) && e.target !== openPaletteBtn) {
            palettePopup.style.display = "none";
        }
    });

    saveBtn.onclick = () => {
        if (editingAgent) {
            editingAgent.name = nameInput.value;
            editingAgent.color = colorDisplay.dataset.color;
            editingAgent.seniority = document.getElementById("editAgentSeniority").value;
            
            // Update Marker
            editingAgent.marker.setLabel({
                ...editingAgent.marker.getLabel(),
                text: editingAgent.name
            });
            const icon = editingAgent.marker.getIcon();
            icon.fillColor = editingAgent.color;
            editingAgent.marker.setIcon(icon);
            
            // Update Polyline
            editingAgent.polyline.setOptions({ strokeColor: editingAgent.color });
            
            updateAgentPolyline(editingAgent); // Refresh shaded paths
            
            if (typeof triggerStateChange === 'function') {
                triggerStateChange({ type: 'agent_updated', agentId: editingAgent.id });
            } else {
                updateAgentListUI();
            }
            
            editModal.style.display = "none";
            editingAgent = null;
        }
    };

    cancelBtn.onclick = () => {
        editModal.style.display = "none";
        editingAgent = null;
    };
}

function openEditAgentModal(agent) {
    editingAgent = agent;
    const editModal = document.getElementById("editAgentModal");
    const nameInput = document.getElementById("editAgentName");
    const colorDisplay = document.getElementById("currentColorDisplay");
    const senioritySelect = document.getElementById("editAgentSeniority");
    
    nameInput.value = agent.name;
    colorDisplay.style.backgroundColor = agent.color;
    colorDisplay.dataset.color = agent.color;
    if (senioritySelect) senioritySelect.value = agent.seniority || 'Junior';
    
    editModal.style.display = "flex";
}

function initTaskDashboardUI() {
    const dash = document.getElementById("taskDashboard");
    const openBtn = document.getElementById("openTaskDashBtn");
    const closeBtn = document.getElementById("closeTaskDashBtn");
    const applyBtn = document.getElementById("applyOptimizationBtn");

    if (!dash) return;

    openBtn.onclick = () => {
        dash.classList.remove("hidden");
        triggerStateChange({ type: 'dashboard_opened' });
    };

    closeBtn.onclick = () => {
        dash.classList.add("hidden");
    };

    if (applyBtn) {
        applyBtn.onclick = () => {
            redistributeAllTasks();
            triggerStateChange({ type: 'routes_optimized' });
            showNotification("System Optimized", "Routes re-calculated with new priority weights.", "success");
        };
    }

    // Handle sliders
    const sliders = document.querySelectorAll(".factor-slider");
    sliders.forEach(slider => {
        slider.oninput = (e) => {
            const val = e.target.value;
            const display = e.target.parentElement.querySelector(".factor-value");
            if (display) display.innerText = `${val}x`;
            
            // Update internal state
            const factor = e.target.dataset.factor;
            if (!AppState.simulation.priorityFactors) AppState.simulation.priorityFactors = {};
            AppState.simulation.priorityFactors[factor] = parseFloat(val);
        };
        
        // Init values
        const factor = slider.dataset.factor;
        if (!AppState.simulation.priorityFactors) AppState.simulation.priorityFactors = {};
        if (!AppState.simulation.priorityFactors[factor]) {
            AppState.simulation.priorityFactors[factor] = parseFloat(slider.value);
        }
    });

    const maxTasksSlider = document.getElementById("maxTasksSlider");
    const maxTasksValue = document.getElementById("maxTasksValue");
    const routeDepthSlider = document.getElementById("routeDepthSlider");
    const routeDepthValue = document.getElementById("routeDepthValue");
    const dashAddAgentBtn = document.getElementById("dashAddAgentBtn");
    const dashAddTasksBtn = document.getElementById("dashAddTasksBtn");

    if (maxTasksSlider && maxTasksValue) {
        maxTasksSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            maxTasksValue.innerText = val;
            AppState.simulation.maxTasksPerAgent = val;
        };
        // Init
        maxTasksSlider.value = AppState.simulation.maxTasksPerAgent || 10;
        maxTasksValue.innerText = maxTasksSlider.value;
    }

    const workSpeedSlider = document.getElementById("simWorkSpeedSlider");
    const workSpeedValueDisplay = document.getElementById("workSpeedValueDisplay");
    if (workSpeedSlider && workSpeedValueDisplay) {
        workSpeedSlider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            workSpeedValueDisplay.innerText = `${val}x`;
            AppState.simulation.workSpeed = val;
        };
        // Init
        workSpeedSlider.value = AppState.simulation.workSpeed || 1;
        workSpeedValueDisplay.innerText = `${workSpeedSlider.value}x`;
    }

    if (routeDepthSlider && routeDepthValue) {
        routeDepthSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            routeDepthValue.innerText = val;
            AppState.simulation.routeDepth = val;
        };
        // Init
        routeDepthSlider.value = AppState.simulation.routeDepth || 2;
        routeDepthValue.innerText = routeDepthSlider.value;
    }

    if (dashAddAgentBtn) {
        dashAddAgentBtn.onclick = () => {
            addRandomAgent();
            triggerStateChange({ type: 'agent_added' });
        };
    }

    if (dashAddTasksBtn) {
        dashAddTasksBtn.onclick = () => {
            simulateRandomTasks();
            triggerStateChange({ type: 'tasks_added' });
        };
    }
    // Register for state changes
    window.addEventListener('stateChanged', (e) => {
        if (e.detail && e.detail.type === 'agent_updated' || e.detail.type === 'task_assigned') {
             updateAgentListUI();
        }
    });
}

// Task Management Logic handled by OperationalDashboard.js
function initSimulationUI() {

    // 3. Populate Open Tickets & Critical Count
    if (hbOpenTickets) hbOpenTickets.innerText = allActiveTasks.length;
    if (hbCriticalTasks) {
        const criticalTasks = allActiveTasks.filter(t => {
            const priority = t.priority || t.Priority || "";
            
            // Per user request: Don't add long-duration tasks to Critical count
            let isLongStanding = false;
            if (t.date_created || t.created_at) {
                const created = new Date(t.date_created || t.created_at);
                const daysOpen = (new Date() - created) / (1000 * 60 * 60 * 24);
                if (daysOpen > 30) isLongStanding = true;
            }

            if (isLongStanding) return false;
            
            return priority === "Critical" || priority === "High" || t.workflow_status_id === 1;
        });
        hbCriticalTasks.innerText = criticalTasks.length;
    }

    // 4. Calculate Active Techs
    if (hbActiveTechs) {
        const liveTechs = (AppState.trackerPositions || []).length;
        const simTechs = AppState.simulation.active ? AppState.simulation.agents.length : 0;
        hbActiveTechs.innerText = liveTechs + simTechs;
    }

    agentCount.innerText = `${AppState.simulation.agents.length} Agents`;
    taskCount.innerText = `${allActiveTasks.filter(t => !t.isLive).length} Sim Tasks`;

    // Populate Agents (Live + Sim)
    agentList.innerHTML = "";
    
    // Helper to render an agent card
    const renderAgentCard = (agent, isLive = false) => {
        const div = document.createElement("div");
        div.className = "p-4 rounded-xl border border-slate-100 bg-white hover:border-primary-200 hover:shadow-md transition-all cursor-pointer group";
        
        let queueCount = 0;
        let progress = 0;
        let status = "Unknown";
        let color = agent.color || (isLive ? "#10b981" : "#3b82f6");
        let distance = 0;
        
        // Assign random metadata for visual flair if missing
        const skills = agent.skills || (isLive ? ["Support", "Fibre"] : ["Wireless", "Installs"]);
        const seniority = agent.seniority || (isLive ? "Field Tech" : "Sim Agent");
        const maxTasks = AppState.simulation.maxTasksPerAgent || 10;

        if (isLive) {
            if (AppState.tasks) {
                queueCount = AppState.tasks.filter(t => {
                    const assigneeId = t.assignee || t.assignee_id || t.workflow_status_id;
                    return String(assigneeId) === String(agent.id);
                }).length;
            }
            status = "Online";
            if (AppState.trackerPositions) {
                const pos = AppState.trackerPositions.find(p => p.attributes?.name === agent.name || p.deviceId === agent.id);
                if (pos) {
                    status = pos.speed > 5 ? "Moving" : "On Site";
                    distance = (pos.attributes?.totalDistance || 0) / 1000;
                }
            }
            progress = Math.min((queueCount / maxTasks) * 100, 100);
        } else {
            queueCount = agent.taskQueue.length;
            progress = agent.status === "At Customer" ? 100 : (agent.status === "Moving" ? Math.floor((agent.currentPointIndex / agent.path.length) * 100) : 0);
            status = agent.status;
            distance = agent.stats.distanceTraveled / 1000;
        }
        
        const workloadColor = queueCount > 8 ? "bg-red-500" : queueCount > 5 ? "bg-amber-500" : "bg-emerald-500";
        
        div.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110" style="background-color: ${color}">
                            <i data-lucide="${isLive ? 'user' : 'navigation'}" class="w-6 h-6"></i>
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isLive ? 'bg-emerald-500' : 'bg-blue-500'}"></div>
                    </div>
                    <div>
                        <div class="font-bold text-slate-800 flex items-center gap-2">
                            ${agent.name}
                            ${isLive ? '<span class="text-[8px] bg-emerald-100 text-emerald-600 px-1 py-0.5 rounded font-black uppercase">Live</span>' : ''}
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1">
                            <span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600 border border-slate-200">${seniority}</span>
                            ${skills.slice(0, 2).map(s => `<span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-primary-50 text-primary-600 border border-primary-100">${s}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <span class="text-sm font-black text-slate-800">${queueCount}</span>
                        <span class="text-[10px] font-bold text-slate-400 uppercase">Tasks</span>
                    </div>
                    <div class="text-[10px] font-bold text-slate-400 mt-0.5">${distance.toFixed(1)}km</div>
                </div>
            </div>
            
            <div class="space-y-1.5">
                <div class="flex justify-between items-center text-[10px] font-bold">
                    <span class="text-slate-500 uppercase">${status}</span>
                    <span class="${queueCount > 8 ? 'text-red-600' : 'text-slate-400'}">${queueCount}/${maxTasks} Cap</span>
                </div>
                <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5">
                    <div class="h-full rounded-full transition-all duration-700 ${isLive ? workloadColor : ''}" style="width: ${progress}%; ${!isLive ? `background-color: ${color}` : ''}"></div>
                </div>
            </div>
        `;
        
        div.onclick = () => {
            if (isLive) {
                if (AppState.trackerMarkers) {
                    const markerData = AppState.trackerMarkers.find(m => m.deviceName === agent.name || m.position.deviceId === agent.id);
                    if (markerData) {
                        AppState.map.panTo(markerData.marker.getPosition());
                        AppState.map.setZoom(15);
                        document.getElementById("taskDashboard")?.classList.add("hidden");
                    }
                }
            } else {
                AppState.map.panTo(agent.marker.getPosition());
                AppState.map.setZoom(15);
                document.getElementById("taskDashboard")?.classList.add("hidden");
            }
        };
        
        agentList.appendChild(div);
    };

    // Render Live Techs first
    if (AppState.team && AppState.team.members) {
        AppState.team.members.forEach(member => renderAgentCard(member, true));
    }

    // Render Sim Agents
    AppState.simulation.agents.forEach(agent => renderAgentCard(agent, false));

    // Populate Tasks
    taskList.innerHTML = "";
    
    // Sort all tasks by urgency score
    const getUrgencyScore = (task) => {
        let score = 0;
        const priority = task.priority || task.Priority || "Medium";
        if (priority === "Critical") score += 100;
        if (priority === "High") score += 60;
        if (priority === "Medium") score += 20;
        
        // Add score for task age
        if (task.date_created || task.created_at) {
            const created = new Date(task.date_created || task.created_at);
            const daysOpen = (new Date() - created) / (1000 * 60 * 60 * 24);
            score += Math.min(daysOpen * 2, 50); // Up to 50 points for age
            
            // Per user request: Purple highlight for > 30 days, but we still sort it highly
            if (daysOpen > 30) score += 30; 
        }
        
        // Add score if near a down tower (Firefighting)
        if (task.customerObj && AppState.customerTowerCache && AppState.customerTowerCache[task.customerObj.id]) {
            const towers = AppState.customerTowerCache[task.customerObj.id];
            const isOutage = towers.some(tid => {
                const status = AppState.nagiosStatus[tid];
                return status && (status.overallStatus === "CRITICAL" || status.overallStatus === "DOWN");
            });
            if (isOutage) score += 80;
        }
        
        // Bonus for Live tasks (Real-world priority)
        if (task.isLive) score += 15;
        
        return score;
    };

    allActiveTasks.sort((a, b) => getUrgencyScore(b) - getUrgencyScore(a));

    allActiveTasks.slice(0, 30).forEach(task => {
        const div = document.createElement("div");
        
        let isLongStanding = false;
        if (task.date_created || task.created_at) {
            const created = new Date(task.date_created || task.created_at);
            const daysOpen = (new Date() - created) / (1000 * 60 * 60 * 24);
            if (daysOpen > 30) isLongStanding = true;
        }

        const priority = task.priority || task.Priority || "Medium";
        const priorityColors = {
            "Critical": "bg-red-500 text-white",
            "High": "bg-orange-500 text-white",
            "Medium": "bg-blue-500 text-white",
            "Low": "bg-slate-500 text-white"
        };
        
        const customerName = task.Customer || (task.customerObj ? task.customerObj.name : "Unknown Customer");
        const taskId = task.ID || task.id;
        
        // Determine category bucket
        let category = "Support";
        const desc = (task.description || task.Description || "").toLowerCase();
        if (desc.includes("install") || desc.includes("new connection")) category = "Installation";
        else if (desc.includes("fault") || desc.includes("down") || desc.includes("no internet")) category = "Fault";
        else if (desc.includes("maintenance") || desc.includes("upgrade")) category = "Network";

        const categoryIcons = {
            "Installation": "plus-circle",
            "Fault": "alert-triangle",
            "Network": "server",
            "Support": "help-circle"
        };

        div.className = `p-4 rounded-xl border ${isLongStanding ? 'bg-purple-50/50 border-purple-200' : 'bg-white border-slate-100'} hover:border-primary-300 hover:shadow-md transition-all flex justify-between items-center group cursor-pointer`;
        
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="relative">
                    <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                        <i data-lucide="${categoryIcons[category] || 'clipboard-list'}" class="w-5 h-5"></i>
                    </div>
                    ${task.isLive ? '<div class="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></div>' : ''}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <div class="text-sm font-black text-slate-800">${customerName}</div>
                        ${isLongStanding ? '<span class="px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 text-[8px] font-black uppercase tracking-tighter">Legacy</span>' : ''}
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[10px] font-bold text-slate-400">#${taskId}</span>
                        <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${category}</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="text-right hidden sm:block">
                    <div class="text-[10px] font-black uppercase tracking-widest ${isLongStanding ? 'text-purple-500' : 'text-slate-300'}">${isLongStanding ? 'Long Standing' : 'Priority'}</div>
                    <div class="flex justify-end mt-1">
                        <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${priorityColors[priority] || 'bg-slate-100 text-slate-600'}">${priority.toUpperCase()}</span>
                    </div>
                </div>
                <div class="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </div>
        `;
        
        div.onclick = () => {
            const customerObj = task.customerObj || (task.isLive && AppState.customerById[task.related_customer_id || task.customer_id]);
            if (customerObj && customerObj.gps) {
                const parts = customerObj.gps.split(',').map(Number);
                if (parts.length === 2) {
                    AppState.map.setCenter({ lat: parts[0], lng: parts[1] });
                    AppState.map.setZoom(17);
                    // Close dashboard to show map
                    document.getElementById("taskDashboard").classList.add("hidden");
                }
            }
        };
        
        taskList.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
}

function initSimulationUI() {
    if (simulationUIInitialized) return;
    console.log("Initializing Simulation UI...");
    simulationUIInitialized = true;
    
    // Initialize new components
    initAgentCustomizationUI();
    initTaskDashboardUI();
    
    // Instantiate services here to ensure google object is available
    if (window.google) {
        if (!directionsService) {
            directionsService = new google.maps.DirectionsService();
            console.log("DirectionsService initialized");
        }
        if (!distanceMatrixService) {
            distanceMatrixService = new google.maps.DistanceMatrixService();
            console.log("DistanceMatrixService initialized");
        }
    }

    const startBtn = document.getElementById("startSimBtn");
    const stopBtn = document.getElementById("stopSimBtn");
    const addAgentBtn = document.getElementById("addAgentBtn");
    const simTasksBtn = document.getElementById("simRandomTasksBtn");
    const simOutageBtn = document.getElementById("simTowerOutageBtn");
    const simStormBtn = document.getElementById("simStormBtn");
    const optimizeBtn = document.getElementById("optimizeRoutesBtn");
    const clearBtn = document.getElementById("clearScenariosBtn");
    const testNotifyBtn = document.getElementById("testNotifyBtn");
    const heatmapCheckbox = document.getElementById("toggleHeatmapCheckbox");
    const speedSlider = document.getElementById("simSpeedSlider");
    const speedDisplay = document.getElementById("speedValueDisplay");

    const nagiosCheckbox = document.getElementById("toggleNagiosCheckbox");

    if (nagiosCheckbox) {
        nagiosCheckbox.addEventListener("change", async (e) => {
            try {
                const res = await fetch(`/api/nagios/toggle?enabled=${e.target.checked}`);
                if (res.ok) {
                    showNotification("Nagios Toggle", `Nagios fetching ${e.target.checked ? 'Enabled' : 'Disabled'}`, "info");
                }
            } catch (err) {
                console.error("Failed to toggle Nagios:", err);
            }
        });
    }

    if (startBtn) {
        startBtn.addEventListener("click", () => startSimulation());
        console.log("Start button listener attached");
    }

    if (stopBtn) {
        stopBtn.addEventListener("click", () => stopSimulation());
        console.log("Stop button listener attached");
    }

    if (addAgentBtn) {
        addAgentBtn.addEventListener("click", () => addRandomAgent());
    }

    if (simTasksBtn) {
        simTasksBtn.addEventListener("click", () => simulateRandomTasks());
    }

    if (simOutageBtn) {
        simOutageBtn.addEventListener("click", () => simulateRandomOutage());
    }

    if (simStormBtn) {
        simStormBtn.addEventListener("click", () => simulateStormEvent());
    }

    if (optimizeBtn) {
        optimizeBtn.addEventListener("click", () => optimizeAgentRoutes());
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => clearScenarios());
    }

    if (testNotifyBtn) {
        testNotifyBtn.addEventListener("click", () => {
            showNotification("Test Notification", "This is a sample alert for feature testing.", "info");
        });
    }

    const centerOfficeBtn = document.getElementById("centerOfficeBtn");
    if (centerOfficeBtn) {
        centerOfficeBtn.addEventListener("click", () => {
            if (AppState.map) {
                AppState.map.panTo(OFFICE_LOCATION);
                AppState.map.setZoom(16);
            }
        });
    }

    if (heatmapCheckbox) {
        heatmapCheckbox.addEventListener("change", (e) => {
            toggleHeatmap(e.target.checked);
        });
    }

    if (speedSlider) {
        speedSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            AppState.simulation.speed = val;
            if (speedDisplay) speedDisplay.innerText = val.toFixed(1) + "x";
        });
    }
}

async function startSimulation() {
    console.log("Entering Simulation Mode...");
    AppState.simulation.active = true;
    document.getElementById("startSimBtn").disabled = true;
    document.getElementById("stopSimBtn").disabled = false;
    
    // Show simulation banner
    const banner = document.getElementById("simBanner");
    if (banner) banner.style.display = "block";

    // Update Right Sidebar for Agent Management
    const teamContent = document.getElementById("teamManagementContent");
    const agentContent = document.getElementById("agentList");
    const sidebarTitle = document.querySelector("#rightSidebarHeader span");
    const sidebarIcon = document.querySelector("#rightSidebarHeader i[data-lucide='users']");
    const clearTeamBtn = document.getElementById("clearTeamBtn");

    if (teamContent) teamContent.classList.add("hidden");
    if (agentContent) {
        agentContent.classList.remove("hidden");
        agentContent.style.display = "flex";
        agentContent.style.flexDirection = "column";
    }
    if (sidebarTitle) sidebarTitle.innerText = "Agent Management";
    if (sidebarIcon) sidebarIcon.setAttribute("data-lucide", "navigation");
    if (clearTeamBtn) clearTeamBtn.style.display = "none";
    if (window.lucide) window.lucide.createIcons();

    // Expand right sidebar if collapsed
    const rightSidebar = document.getElementById("rightSidebar");
    if (rightSidebar && rightSidebar.classList.contains('collapsed')) {
        const toggleBtn = document.getElementById("rightToggleBtn");
        if (toggleBtn) toggleBtn.click();
    }

    // DATA SEPARATION: Clear real tasks and use simulated environment
    switchToSimulationMode();
    
    // Set virtual time to now
    AppState.simulation.time = Date.now();
    AppState.simulation.shiftLimit = 8 * 3600 * 1000; // 8 Hours

    // Add office marker during simulation
    if (!AppState.simulation.officeMarker) {
        AppState.simulation.officeMarker = new google.maps.Marker({
            position: OFFICE_LOCATION,
            map: AppState.map,
            title: "Belanet Office",
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                labelOrigin: new google.maps.Point(10, -10)
            },
            label: { text: "Office", color: "#2196F3", fontWeight: "bold" }
        });
    } else {
        AppState.simulation.officeMarker.setMap(AppState.map);
    }

    // Add click listeners to customer markers for simulation
    AppState.customerMarkers.forEach(data => {
        // Clear previous listeners if any (simple way: replace marker click)
        google.maps.event.clearListeners(data.marker, 'click');
        data.marker.addListener("click", () => {
            if (AppState.simulation.active) {
                sendAgentToCustomer(data.customer);
            } else if (window.AppState.bulkSelectMode) {
                const taskIds = (data.customer.tasks || []).map(t => t.ID || t.id).filter(id => id);
                if (taskIds.length > 0 && typeof window.addTasksToAssignment === 'function') {
                    window.addTasksToAssignment(taskIds.join(','));
                    data.marker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => data.marker.setAnimation(null), 700);
                }
            } else {
                // Restore default info window behavior if not in sim
                showCustomerInfoWindow(data);
            }
        });
    });

    // Start movement loop
    if (!simulationInterval) {
        simulationInterval = setInterval(updateSimulation, 100); // 100ms for smoother animation
    }
    
    // Periodically update marker indicators
    if (!markerUpdateInterval) {
        markerUpdateInterval = setInterval(updateMarkerIndicators, 2000);
    }

    // Populate agent list initially (shows header/empty state)
    updateAgentListUI();
    
    showNotification("Simulation Active", "Data has been separated for testing.", "success");
}

function switchToSimulationMode() {
    console.log("Clearing real tasks for simulation...");
    if (!AppState.customers) return;

    // Toggle right panel header
    const rightHeader = document.querySelector("#rightSidebarHeader .font-bold");
    if (rightHeader) rightHeader.innerText = "Agent Management (Sim)";
    
    const teamContent = document.getElementById("teamManagementContent");
    if (teamContent) teamContent.classList.add("hidden");
    
    const agentListContainer = document.getElementById("agentList");
    if (agentListContainer) {
        agentListContainer.classList.remove("hidden");
        agentListContainer.style.maxHeight = "calc(100vh - 120px)";
    }

    AppState.customers.forEach(cust => {
        cust.tasks = []; // Clear real tasks
        // Update marker icon to "clean" state
        const markerData = AppState.customerMarkers.find(m => m.customer.id === cust.id);
        if (markerData) {
            markerData.marker.setIcon(getCustomerIcon(cust));
        }
    });
}

function restoreRealData() {
    console.log("Restoring real task data...");
    if (!AppState.customers || !AppState.tasks) return;

    // Restore right panel header
    const rightHeader = document.querySelector("#rightSidebarHeader .font-bold");
    if (rightHeader) rightHeader.innerText = "Team Management";
    const teamContent = document.getElementById("teamManagementContent");
    if (teamContent) {
        teamContent.classList.remove("hidden");
        teamContent.style.display = "flex";
    }
    const agentListContainer = document.getElementById("agentList");
    if (agentListContainer) {
        agentListContainer.classList.add("hidden");
        agentListContainer.style.maxHeight = "150px";
    }

    // Reset customer tasks
    AppState.customers.forEach(cust => {
        cust.tasks = [];
    });
    
    // Re-link real tasks
    const customerByName = {};
    AppState.customers.forEach(cust => {
        customerByName[cust.name] = cust;
    });

    AppState.tasks.forEach(task => {
        const customer = customerByName[task.Customer];
        if (customer) {
            customer.tasks.push(task);
        }
    });

    // Update all markers and info windows
    AppState.customerMarkers.forEach(data => {
        data.marker.setIcon(getCustomerIcon(data.customer));
        
        // Restore default click listener
        google.maps.event.clearListeners(data.marker, 'click');
        data.marker.addListener("click", () => {
            if (window.AppState.bulkSelectMode) {
                const taskIds = (data.customer.tasks || []).map(t => t.ID || t.id).filter(id => id);
                if (taskIds.length > 0 && typeof window.addTasksToAssignment === 'function') {
                    window.addTasksToAssignment(taskIds.join(','));
                    data.marker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => data.marker.setAnimation(null), 700);
                }
            } else {
                showCustomerInfoWindow(data);
            }
        });
    });

    // Remove office marker
    if (AppState.simulation.officeMarker) {
        AppState.simulation.officeMarker.setMap(null);
    }
}

// Helper to show the original info window
function showCustomerInfoWindow(markerData) {
    const cust = markerData.customer;
    const taskIds = (cust.tasks || []).map(t => t.ID || t.id).filter(id => id);
    const hasTasks = taskIds.length > 0;
    
    const content = `
        <div style="font-size: 14px; min-width: 200px; padding: 5px;">
            <div style="font-weight: 800; font-size: 16px; margin-bottom: 8px; color: #1e293b;">${cust.name}</div>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin-bottom: 12px;">
                <span style="color: #64748b; font-weight: 500;">ID:</span> <span style="font-weight: 600;">${cust.id}</span>
                <span style="color: #64748b; font-weight: 500;">Status:</span> <span style="font-weight: 600; text-transform: capitalize;">${cust.status}</span>
                <span style="color: #64748b; font-weight: 500;">Tasks:</span> <span style="font-weight: 700; color: ${hasTasks ? '#ef4444' : '#10b981'}">${cust.tasks.length}</span>
            </div>
            
            ${hasTasks ? `
                <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; pt-10px; padding-top: 10px;">
                    <button onclick="window.addTasksToAssignment('${taskIds.join(',')}')" 
                            style="width: 100%; background: #7c3aed; color: white; border: none; padding: 8px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        Add Tasks to Assignment
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    if (!markerData.infoWindow) {
        markerData.infoWindow = new google.maps.InfoWindow({ content });
    } else {
        markerData.infoWindow.setContent(content);
    }
    markerData.infoWindow.open(AppState.map, markerData.marker);
}

async function fetchRoute(origin, destination) {
    if (!directionsService) {
        directionsService = new google.maps.DirectionsService();
        console.log("DirectionsService initialized in fetchRoute");
    }
    
    // Convert destination to LatLng if it's a plain object for consistent logging
    const destLatLng = (destination instanceof google.maps.LatLng) ? destination : new google.maps.LatLng(destination.lat, destination.lng);
    const originLatLng = (origin instanceof google.maps.LatLng) ? origin : (origin.lat ? new google.maps.LatLng(origin.lat, origin.lng) : origin);

    console.log("Routing Request:", {
        origin: originLatLng.toString(),
        destination: destLatLng.toString()
    });
    
    return new Promise((resolve, reject) => {
        const request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING
        };

        // Add traffic awareness if simulation is active
        if (AppState.simulation.active) {
            request.drivingOptions = {
                departureTime: new Date(AppState.simulation.time),
                trafficModel: 'bestguess'
            };
        }

        directionsService.route(request, (result, status) => {
            console.log("Routing Status:", status);
            if (status === google.maps.DirectionsStatus.OK) {
                const route = result.routes[0];
                const leg = route.legs[0];
                
                console.log(`Route found: ${leg.distance.text}, ${leg.duration.text}`);
                
                // Get high-resolution path by combining all step points
                const points = [];
                leg.steps.forEach(step => {
                    step.path.forEach(p => points.push(p));
                });

                if (leg.duration_in_traffic) {
                    console.log(`Duration in traffic: ${leg.duration_in_traffic.text}`);
                    const baseDuration = leg.duration.value;
                    const trafficDuration = leg.duration_in_traffic.value;
                    const factor = trafficDuration / baseDuration;
                    resolve({ points: points, trafficFactor: factor });
                } else {
                    resolve({ points: points, trafficFactor: 1.0 });
                }
            } else {
                console.warn(`Routing failed (${status}). Falling back to straight-line path.`);
                
                // FALLBACK: Generate straight-line points if Directions API is denied or fails
                const points = generateStraightLinePath(originLatLng, destLatLng);
                console.log(`Generated fallback path with ${points.length} points`);
                resolve({ points: points, trafficFactor: 1.0 });
            }
        });
    });
}

/**
 * Generates a series of points along a straight line between two locations
 * used as a fallback when Directions API is unavailable.
 */
function generateStraightLinePath(start, end, steps = 100) {
    const points = [];
    const startLat = start.lat();
    const startLng = start.lng();
    const endLat = end.lat();
    const endLng = end.lng();

    for (let i = 0; i <= steps; i++) {
        const fraction = i / steps;
        const lat = startLat + (endLat - startLat) * fraction;
        const lng = startLng + (endLng - startLng) * fraction;
        points.push(new google.maps.LatLng(lat, lng));
    }
    return points;
}

async function createNewAgent(name, color, startLocation = OFFICE_LOCATION) {
    const agentId = Date.now() + Math.floor(Math.random() * 1000);
    const agentName = name || `Tech ${AppState.simulation.agents.length + 1}`;
    
    // Assign random skills but pick a primary one for color
    const skills = [...SIM_SKILLS].sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 2));
    const primarySkill = skills[0];
    const baseHue = SKILL_COLORS[primarySkill] || Math.random() * 360;
    
    // Assign random seniority
    const seniority = SENIORITY_LEVELS[Math.floor(Math.random() * SENIORITY_LEVELS.length)];
    
    // If no color provided, generate one based on primary skill hue
    const agentColor = color || hslToHex(baseHue + (Math.random() * 20 - 10), 70 + Math.random() * 20, 45 + Math.random() * 10);

    const agentMarker = new google.maps.Marker({
        position: startLocation,
        map: AppState.map,
        title: agentName,
        label: {
            text: agentName,
            color: "#1e293b",
            fontWeight: "bold",
            fontSize: "12px",
            className: "marker-label-base"
        },
        icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: agentColor,
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
            rotation: 0,
            labelOrigin: new google.maps.Point(0, -2.5)
        }
    });

    const agent = {
        id: agentId,
        name: agentName,
        color: agentColor,
        seniority: seniority,
        primarySkill: primarySkill,
        marker: agentMarker,
        skills: skills,
        // Assign random proficiency for each skill (1 to 10)
        proficiencies: skills.reduce((acc, skill) => ({
            ...acc,
            [skill]: 3 + Math.floor(Math.random() * 8)
        }), {}),
        inventory: SIM_PARTS.reduce((acc, part) => ({ ...acc, [part]: 5 + Math.floor(Math.random() * 10) }), {}),
        polyline: new google.maps.Polyline({
            map: AppState.map,
            strokeColor: agentColor,
            strokeOpacity: 0.8,
            strokeWeight: 5,
            path: []
        }),
        queuePolylines: [], // For shaded paths
        path: [],
        currentPointIndex: 0,
        status: "Idle",
        targetCustomer: null,
        taskQueue: [],
        // New stats for Agent Management
        stats: {
            distanceTraveled: 0, // in meters
            tasksCompleted: 0,
            completedTasks: [], // Track task IDs for dashboard
            fuelUsed: 0, // in liters (estimate)
            startTime: AppState.simulation.time,
            lastUpdateTime: AppState.simulation.time
        }
    };

    AppState.simulation.agents.push(agent);
    updateAgentListUI();
    return agent;
}

async function sendAgentToCustomer(customer) {
    if (!AppState.simulation.active) return;
    
    console.log(`Adding customer to simulation tasks: ${customer.name}`);
    
    // Ensure task exists for this customer so redistribution picks it up
    if (!customer.tasks) customer.tasks = [];
    const priority = ["Low", "Medium", "High", "Critical"][Math.floor(Math.random() * 4)];
    const complexity = ["Low", "Medium", "High"][Math.floor(Math.random() * 3)];
    const newTask = {
        id: `SIM-CLICK-${Date.now()}`,
        Customer: customer.name,
        status: "Pending (Simulated)",
        description: "Manually assigned task",
        requiredSkills: [SIM_SKILLS[Math.floor(Math.random() * SIM_SKILLS.length)]],
        requiredParts: { [SIM_PARTS[Math.floor(Math.random() * SIM_PARTS.length)]]: 1 },
        priority: priority,
        complexity: complexity,
        dueBy: Date.now() + (Math.random() * 8 * 3600 * 1000), // Due within 8 hours
        createdTime: Date.now()
    };
    customer.tasks.push(newTask);
    
    // ADDED: Push to global simulation tasks list so it shows in dashboard
    if (AppState.simulation.tasks) AppState.simulation.tasks.push(newTask);

    // Update marker icon
    const markerData = AppState.customerMarkers.find(m => m.customer.id === customer.id);
    if (markerData) {
        markerData.marker.setIcon(getCustomerIcon(customer));
    }

    // Trigger full redistribution to find best agent and optimize
    showNotification("Task Assigned", `Assigned ${customer.name} to the team. Optimizing routes...`, "info");
    redistributeAllTasks();
}

async function updateAgentPolyline(agent) {
    // Clear existing queue polylines
    if (agent.queuePolylines) {
        agent.queuePolylines.forEach(p => p.setMap(null));
    }
    agent.queuePolylines = [];

    if (!agent.taskQueue || agent.taskQueue.length === 0) {
        if (agent.status !== "Returning to Office") {
            agent.polyline.setPath([]);
            agent.taskQueuePaths = [];
        }
        return;
    }

    let lastPos = agent.marker.getPosition();
    const newQueuePaths = [];
    const newTrafficFactors = [];

    const routeDepth = AppState.simulation.routeDepth || 2;

    for (let i = 0; i < agent.taskQueue.length; i++) {
        const task = agent.taskQueue[i];
        const dest = getCoords(task);
        if (!dest) continue;

        // Controlled HD routing depth based on user setting
        if (i < routeDepth) {
            try {
                if (i > 0) await new Promise(r => setTimeout(r, 150)); // Slightly longer delay to respect API limits
                const { points, trafficFactor } = await fetchRoute(lastPos, dest);
                newQueuePaths.push(points);
                newTrafficFactors.push(trafficFactor);
                lastPos = points[points.length - 1];
            } catch (error) {
                const destLatLng = new google.maps.LatLng(dest.lat, dest.lng);
                const points = generateStraightLinePath(lastPos, destLatLng, 50);
                newQueuePaths.push(points);
                newTrafficFactors.push(1.0);
                lastPos = destLatLng;
            }
        } else {
            // Beyond depth, we use straight lines or just store the segment (we still want to see the path order)
            const destLatLng = new google.maps.LatLng(dest.lat, dest.lng);
            const points = generateStraightLinePath(lastPos, destLatLng, 5);
            newQueuePaths.push(points);
            newTrafficFactors.push(1.0);
            lastPos = destLatLng;
        }
    }

    agent.taskQueuePaths = newQueuePaths;
    agent.taskQueueTrafficFactors = newTrafficFactors;

    // The first segment uses the main agent.polyline
    if (newQueuePaths.length > 0) {
        agent.polyline.setPath(newQueuePaths[0]);
        // Current task path is slightly lightened base color
        const firstSegmentColor = adjustColor(agent.color, 20);
        agent.polyline.setOptions({ strokeColor: firstSegmentColor, strokeOpacity: 1.0 });

        // Subsequent segments use shaded polylines
        for (let i = 1; i < newQueuePaths.length; i++) {
            // Start light and get darker for each subsequent task
            const shadePercent = 20 - (i * 15); 
            const shadedColor = adjustColor(agent.color, Math.max(-60, shadePercent));
            
            const qp = new google.maps.Polyline({
                map: AppState.map,
                path: newQueuePaths[i],
                strokeColor: shadedColor,
                strokeOpacity: 0.8,
                strokeWeight: 4,
                icons: [{
                    icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2 },
                    offset: '50%'
                }]
            });
            agent.queuePolylines.push(qp);
        }
    }

    if (agent.status === "Moving" && newQueuePaths.length > 0) {
        if (!agent.path || agent.path.length === 0) {
            agent.path = newQueuePaths[0];
            agent.currentTrafficFactor = newTrafficFactors[0] || 1.0;
            agent.currentPointIndex = 0;
        }
    }
}

async function processAgentQueue(agent) {
    if (agent.taskQueue.length === 0) {
        // If no more tasks, return to office
        const dist = google.maps.geometry.spherical.computeDistanceBetween(agent.marker.getPosition(), new google.maps.LatLng(OFFICE_LOCATION));
        if (dist > 100) { // Increased threshold slightly
            if (agent.status === "Returning to Office") return; // Already returning
            
            agent.status = "Returning to Office";
            agent.targetCustomer = { name: "Office" };
            triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
            try {
                const { points, trafficFactor } = await fetchRoute(agent.marker.getPosition(), OFFICE_LOCATION);
                agent.path = points;
                agent.currentTrafficFactor = trafficFactor;
                agent.polyline.setPath(points);
                agent.currentPointIndex = 0;
            } catch (error) {
                console.error("Routing to office failed:", error);
                agent.status = "Idle";
                triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
            }
        } else {
            agent.status = "Idle";
            agent.targetCustomer = null;
            agent.path = [];
            agent.polyline.setPath([]);
            triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
        }
        return;
    }

    const nextTask = agent.taskQueue[0];
    
    // PART CHECK
    const simTask = nextTask.tasks && nextTask.tasks.find(tk => tk.id && tk.id.toString().startsWith("SIM-"));
    if (simTask && simTask.requiredParts) {
        let missingParts = false;
        for (const [part, qty] of Object.entries(simTask.requiredParts)) {
            if ((agent.inventory[part] || 0) < qty) {
                missingParts = true;
                break;
            }
        }
        
        if (missingParts) {
            showNotification("Missing Parts", `${agent.name} is missing parts for the next task. Returning to office.`, "warning");
            agent.status = "Returning to Office";
            agent.targetCustomer = { name: "Office" };
            triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
            try {
                const { points, trafficFactor } = await fetchRoute(agent.marker.getPosition(), OFFICE_LOCATION);
                agent.path = points;
                agent.currentTrafficFactor = trafficFactor;
                agent.polyline.setPath(points);
                agent.currentPointIndex = 0;
            } catch (error) {
                console.error("Routing to office failed:", error);
                agent.status = "Idle";
                updateAgentListUI();
            }
            return;
        }
    }

    agent.targetCustomer = nextTask;
    
    // Reuse already fetched path if available
    if (agent.taskQueuePaths && agent.taskQueuePaths.length > 0) {
        const path = agent.taskQueuePaths[0];
        agent.path = path;
        agent.currentTrafficFactor = (agent.taskQueueTrafficFactors && agent.taskQueueTrafficFactors.length > 0) ? agent.taskQueueTrafficFactors[0] : 1.0;
        agent.currentPointIndex = 0;
        agent.status = "En Route";
        triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
        
        // Update polyline to show full remaining queue
        const futurePaths = agent.taskQueuePaths.slice(1).flat();
        agent.polyline.setPath([...path, ...futurePaths]);
        return;
    }

    const destination = getCoords(nextTask);
    if (!destination) {
        console.error("Task has no coordinates:", nextTask);
        agent.taskQueue.shift();
        processAgentQueue(agent);
        return;
    }

    try {
        const { points, trafficFactor } = await fetchRoute(agent.marker.getPosition(), destination);
        agent.path = points;
        agent.currentTrafficFactor = trafficFactor;
        agent.polyline.setPath(points);
        agent.currentPointIndex = 0;
        agent.status = "En Route";
        triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
    } catch (error) {
        console.error("Routing to task failed:", error);
        agent.status = "Failed to Route";
        triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
    }
}

function stopSimulation() {
    console.log("Stopping Simulation...");

    // Generate and send final report before clearing data
    if (AppState.simulation.agents && AppState.simulation.agents.length > 0) {
        generateSimulationReport();
    }

    AppState.simulation.active = false;
    document.getElementById("startSimBtn").disabled = false;
    document.getElementById("stopSimBtn").disabled = true;

    // Hide simulation banner
    const banner = document.getElementById("simBanner");
    if (banner) banner.style.display = "none";

    // Restore Right Sidebar for Team Management
    const teamContent = document.getElementById("teamManagementContent");
    const agentContent = document.getElementById("agentList");
    const sidebarTitle = document.querySelector("#rightSidebarHeader span");
    const sidebarIcon = document.querySelector("#rightSidebarHeader i[data-lucide='navigation']");
    const clearTeamBtn = document.getElementById("clearTeamBtn");

    if (teamContent) {
        teamContent.classList.remove("hidden");
        teamContent.style.display = "flex";
    }
    if (agentContent) {
        agentContent.classList.add("hidden");
        agentContent.style.display = "none";
    }
    if (sidebarTitle) sidebarTitle.innerText = "Team Management";
    if (sidebarIcon) sidebarIcon.setAttribute("data-lucide", "users");
    if (clearTeamBtn) clearTeamBtn.style.display = "block";
    if (window.lucide) window.lucide.createIcons();

    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }

    // Clear agents
    AppState.simulation.agents.forEach(agent => {
        if (agent.marker) agent.marker.setMap(null);
        if (agent.polyline) agent.polyline.setMap(null);
    });
    AppState.simulation.agents = [];
    updateAgentListUI();

    restoreRealData();
}

let isRedistributing = false;
function assignTaskToAgent(taskId, agentId) {
    const agent = AppState.simulation.agents.find(a => a.id == agentId);
    if (!agent) return { success: false, reason: "Agent not found" };

    // Find task
    let task = null;
    if (AppState.simulation.tasks) {
        task = AppState.simulation.tasks.find(t => t.id == taskId);
    }
    
    // If not in sim tasks, check customer tasks
    if (!task) {
        AppState.customers.forEach(c => {
            if (c.tasks) {
                const found = c.tasks.find(t => t.id == taskId);
                if (found) task = found;
            }
        });
    }

    if (task) {
        // Skill Matching Check
        const taskSkills = task.requiredSkills || (task.requiredSkill ? [task.requiredSkill] : []);
        if (taskSkills.length > 0) {
            if (!agent.skills) {
                showNotification("Skill Mismatch", `Agent ${agent.name} has no skill profile`, "error");
                return { success: false, reason: "No agent skills" };
            }
            const hasSkill = taskSkills.every(skill => agent.skills.includes(skill));
            if (!hasSkill) {
                const missing = taskSkills.filter(s => !agent.skills.includes(s));
                showNotification("Skill Mismatch", `Agent ${agent.name} lacks required skills: ${missing.join(', ')}`, "error");
                return { success: false, reason: "Skill mismatch" };
            }
        }

        // Remove from other agents if assigned
        AppState.simulation.agents.forEach(a => {
            a.taskQueue = a.taskQueue.filter(t => t.id != taskId);
        });

        agent.taskQueue.push(task);
        
        if (agent.status === "Idle" || agent.status === "Returning to Office") {
            processAgentQueue(agent);
        } else {
            updateAgentPolyline(agent);
        }

        if (typeof triggerStateChange === 'function') {
            triggerStateChange({ type: 'task_assigned', taskId, agentId });
        }
        
        showNotification("Task Assigned", `Manually assigned to ${agent.name}`, "success");
        return { success: true };
    }
    return { success: false, reason: "Task not found" };
}

window.assignTaskToAgent = assignTaskToAgent;

async function redistributeAllTasks() {
    if (!AppState.simulation.active || AppState.simulation.agents.length === 0) return;
    if (isRedistributing) return;
    isRedistributing = true;

    try {
        console.log("Redistributing all tasks among agents...");

        // 1. Collect all customers who have simulated tasks
        const customersWithTasks = AppState.customers.filter(c => 
            c.tasks && c.tasks.some(t => t.id && t.id.toString().startsWith("SIM-"))
        );

        // 2. Clear current queues (preserving what they are currently doing)
        AppState.simulation.agents.forEach(agent => {
            const isBusy = ["Moving", "At Customer"].includes(agent.status);
            if (isBusy && agent.taskQueue.length > 0) {
                const currentTask = agent.taskQueue[0];
                agent.taskQueue = [currentTask];
                if (agent.taskQueuePaths && agent.taskQueuePaths.length > 0) {
                    agent.taskQueuePaths = [agent.taskQueuePaths[0]];
                }
            } else {
                agent.taskQueue = [];
                agent.taskQueuePaths = [];
                if (agent.status === "Routing...") agent.status = "Idle";
            }
        });

        // 3. Pool of unassigned customers
        let unassignedCustomers = [...customersWithTasks].filter(c => {
            const hasCoords = c.lat || (c.gps && c.gps.includes(','));
            const notAssigned = !AppState.simulation.agents.some(a => a.taskQueue.some(t => t.id === c.id));
            return hasCoords && notAssigned;
        });

        const factors = AppState.simulation.priorityFactors || { distance: 1, age: 1.5, business: 2, complexity: 1.2, lineSize: 1 };
        const maxTasks = AppState.simulation.maxTasksPerAgent || 10;

        // 4. Fair distribution loop - assigning tasks one by one to agents
        // We use spherical distance for bulk assignment to avoid Distance Matrix limits
        while (unassignedCustomers.length > 0) {
            // Find agents who can still take tasks
            let availableAgents = AppState.simulation.agents.filter(a => a.taskQueue.length < maxTasks);
            if (availableAgents.length === 0) break;

            // Sort agents by workload to maintain fairness
            availableAgents.sort((a, b) => a.taskQueue.length - b.taskQueue.length);
            
            let assignedInThisRound = false;

            for (const agent of availableAgents) {
                if (unassignedCustomers.length === 0) break;

                let lastPos = agent.marker.getPosition();
                if (agent.taskQueue.length > 0) {
                    const lastTask = agent.taskQueue[agent.taskQueue.length - 1];
                    const coords = getCoords(lastTask);
                    if (coords) lastPos = new google.maps.LatLng(coords.lat, coords.lng);
                }

                let bestIdx = -1;
                let bestScore = Infinity;

                unassignedCustomers.forEach((c, idx) => {
                    const simTask = c.tasks.find(t => t.id && t.id.toString().startsWith("SIM-"));
                    
                    // Skill Check
                    if (simTask && simTask.requiredSkills) {
                        const hasSkills = simTask.requiredSkills.every(s => agent.skills.includes(s));
                        if (!hasSkills) return;
                    }

                    const cCoords = getCoords(c);
                    if (!cCoords) return;
                    const cLatLng = new google.maps.LatLng(cCoords.lat, cCoords.lng);
                    const d = google.maps.geometry.spherical.computeDistanceBetween(lastPos, cLatLng);

                    // PRIORITY CALCULATION
                    let weight = 1;
                    if (simTask) {
                        // Base priority
                        const pWeights = { "Critical": 50, "High": 20, "Medium": 10, "Low": 5 };
                        weight = pWeights[simTask.priority] || 5;

                        // Business factor
                        if (simTask.isBusiness) weight *= factors.business;
                        
                        // Age factor
                        const ageInHours = (AppState.simulation.time - (simTask.createdTime || Date.now())) / (3600 * 1000);
                        weight *= (1 + (ageInHours * factors.age * 0.1));

                        // Complexity factor
                        if (simTask.complexity === "High") weight *= factors.complexity;
                        else if (simTask.complexity === "Low") weight /= factors.complexity;

                        // Line Size factor
                        if (simTask.lineSize) weight *= (1 + (simTask.lineSize * factors.lineSize * 0.05));
                    }

                    const score = (d * factors.distance) / weight;
                    if (score < bestScore) {
                        bestScore = score;
                        bestIdx = idx;
                    }
                });

                if (bestIdx !== -1) {
                    const selected = unassignedCustomers.splice(bestIdx, 1)[0];
                    agent.taskQueue.push(selected);
                    assignedInThisRound = true;
                }
            }

            if (!assignedInThisRound) break; // None of the agents can take any of the remaining tasks (skills etc)
        }

        // 5. Refine routes with 2-opt and update visuals
        for (const agent of AppState.simulation.agents) {
            if (agent.taskQueue.length > 1) {
                // Preserving the currently active task if they are busy
                const isBusy = ["Moving", "At Customer"].includes(agent.status);
                if (isBusy) {
                    const currentTask = agent.taskQueue[0];
                    const remainingQueue = agent.taskQueue.slice(1);
                    const taskCoords = getCoords(currentTask);
                    const nextStartPos = taskCoords ? new google.maps.LatLng(taskCoords.lat, taskCoords.lng) : agent.marker.getPosition();
                    
                    agent.taskQueue = [currentTask, ...solve2Opt(remainingQueue, nextStartPos)];
                } else {
                    agent.taskQueue = solve2Opt(agent.taskQueue, agent.marker.getPosition());
                }
            }
            
            await updateAgentPolyline(agent);
            if (["Idle", "Arrived", "Failed to Route"].includes(agent.status) && agent.taskQueue.length > 0) {
                processAgentQueue(agent);
            }
        }

        updateAgentListUI();
    } finally {
        isRedistributing = false;
    }
}

async function addRandomAgent() {
    if (!AppState.customers || AppState.customers.length === 0) return;
    
    // Always create a new agent when requested explicitly
    const agent = await createNewAgent();
    
    showNotification("New Agent", `Added ${agent.name}. Redistributing tasks...`, "success");
    redistributeAllTasks();
}

/**
 * NEW: Predictive Traffic Factor based on simulated time
 */
function getPredictiveTrafficFactor(timestamp) {
    const date = new Date(timestamp);
    const hour = date.getHours();
    
    // Peak hours: 07:00-09:00 and 16:00-18:00
    if ((hour >= 7 && hour < 9) || (hour >= 16 && hour < 18)) {
        return 1.8; // Heavy traffic
    }
    // Lunch time: 12:00-13:00
    if (hour >= 12 && hour < 13) {
        return 1.4;
    }
    // Off-peak
    if (hour >= 20 || hour < 6) {
        return 0.8;
    }
    return 1.1;
}

function updateSimulation() {
    if (!AppState.simulation.active) return;

    // Update virtual time based on speed (100ms interval * speed)
    const timeStep = 100 * AppState.simulation.speed;
    AppState.simulation.time += timeStep;
    updateSimulationClock();

    const trafficFactor = getPredictiveTrafficFactor(AppState.simulation.time);
    const weatherFactor = AppState.simulation.isStorming ? 1.5 : 1.0;

    AppState.simulation.agents.forEach(agent => {
        // Shift Time Check
        const elapsed = AppState.simulation.time - agent.stats.startTime;
        if (elapsed > AppState.simulation.shiftLimit && agent.status !== "Returning to Office" && agent.status !== "Idle") {
            showNotification("Shift Ended", `${agent.name}'s shift has ended. Returning to base.`, "warning");
            agent.taskQueue = [];
            agent.taskQueuePaths = [];
            processAgentQueue(agent);
            return;
        }

        if (agent.path.length > 0 && agent.currentPointIndex < agent.path.length - 1) {
            // Apply both predictive traffic and weather factors
            const currentRouteFactor = agent.currentTrafficFactor || 1.0;
            const combinedFactor = currentRouteFactor * trafficFactor * weatherFactor;
            
            // More granular movement for realism
            const step = (0.1 * AppState.simulation.speed) / combinedFactor;
            const prevIndex = Math.floor(agent.currentPointIndex);
            
            agent.currentPointIndex += step;
            
            if (agent.currentPointIndex >= agent.path.length - 1) {
                agent.currentPointIndex = agent.path.length - 1;
            }

            const idx = Math.floor(agent.currentPointIndex);
            const nextPoint = agent.path[idx];
            
            // Stats tracking: distance moved in this step
            if (idx > prevIndex && idx < agent.path.length) {
                const p1 = agent.path[prevIndex];
                const p2 = agent.path[idx];
                const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
                agent.stats.distanceTraveled += dist;
                agent.stats.fuelUsed += (dist / 1000) * 0.12; // 12L/100km avg
            }

            agent.marker.setPosition(nextPoint);

            const remainingCurrentPath = agent.path.slice(idx);
            agent.polyline.setPath(remainingCurrentPath);
            
            if (idx > 0) {
                const prevPoint = agent.path[idx - 1];
                const heading = google.maps.geometry.spherical.computeHeading(prevPoint, nextPoint);
                const icon = agent.marker.getIcon();
                if (icon) {
                    icon.rotation = heading;
                    agent.marker.setIcon(icon);
                }
            }

            if (agent.currentPointIndex === agent.path.length - 1) {
                if (agent.status === "En Route") {
                    agent.status = "On Site";
                    agent.path = [];
                    agent.polyline.setPath([]);
                    triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
                    
                    // Simulation: Working for a duration scaled by speed and complexity
                    const task = agent.taskQueue[0];
                    const simTask = task.tasks ? task.tasks.find(tk => tk.id && tk.id.toString().startsWith("SIM-")) : task;
                    
                    // Complexity-based duration (in minutes)
                    const complexityDurations = {
                        "Low": 10,
                        "Medium": 20,
                        "High": 45,
                        "Critical": 60
                    };
                    
                    const baseMinutes = complexityDurations[simTask.priority] || complexityDurations[simTask.complexity] || 15;
                    
                    // Proficiency impact: proficiency 10 is 40% faster than baseline (5)
                    const proficiency = (simTask.requiredSkills || []).reduce((best, s) => {
                        return Math.max(best, agent.proficiencies[s] || 5);
                    }, 5);
                    const proficiencyMultiplier = 1 - ((proficiency - 5) * 0.08); 
                    
                    // NEW: Incorporate workSpeed multiplier from Dashboard
                    const workSpeed = AppState.simulation.workSpeed || 1;
                    const workDuration = (baseMinutes * 60 * 1000 * proficiencyMultiplier) / (AppState.simulation.speed * workSpeed); 
                    
                    // Store ETC for the agent
                    agent.workStartedAt = Date.now();
                    agent.expectedWorkDuration = workDuration;
                    
                    if (agent.workTimeout) clearTimeout(agent.workTimeout);
                    // Explicit completion required. Timeout only used for notifications or auto-finishing IF desired.
                    // For now, we disable automatic queue shifting.
                    agent.workTimeout = setTimeout(() => {
                        if (AppState.simulation.active) {
                            agent.workTimeout = null;
                            agent.workFinished = true; // Mark as ready for explicit completion
                            showNotification("Work Finished", `${agent.name} has finished work at ${simTask.Customer}. Ready for completion.`, "info");
                            triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
                        }
                    }, workDuration);
                } else if (agent.status === "Returning to Office") {
                    agent.status = "Idle";
                    
                    // Restock Inventory & Refuel
                    SIM_PARTS.forEach(part => {
                        agent.inventory[part] = 15; // Refill to 15
                    });
                    agent.stats.fuelUsed = 0; // Simulated refuel
                    showNotification("Agent Restocked", `${agent.name} has restocked and refueled at the office.`, "success");

                    agent.path = [];
                    agent.polyline.setPath([]);
                    agent.targetCustomer = null;
                    triggerStateChange({ type: 'agent_status_changed', agentId: agent.id });
                }
            }
        }
    });
}

/**
 * Formally completes a task and moves to the next
 */
function markTaskCompleted(taskId, agentId) {
    const agent = AppState.simulation.agents.find(a => a.id == agentId);
    if (!agent) return;

    if (agent.taskQueue.length > 0 && agent.taskQueue[0].id == taskId) {
        const completedTask = agent.taskQueue.shift();
        
        // Inventory Depletion
        const simTask = completedTask.tasks ? completedTask.tasks.find(tk => tk.id && tk.id.toString().startsWith("SIM-")) : completedTask;
        if (simTask && simTask.requiredParts) {
            for (const [part, qty] of Object.entries(simTask.requiredParts)) {
                agent.inventory[part] = Math.max(0, (agent.inventory[part] || 0) - qty);
            }
        }

        agent.stats.tasksCompleted++;
        if (!agent.stats.completedTasks) agent.stats.completedTasks = [];
        agent.stats.completedTasks.push(taskId);
        
        if (agent.taskQueuePaths) agent.taskQueuePaths.shift();
        
        agent.workFinished = false;
        agent.status = "Idle"; // Temporarily idle until processAgentQueue picks up next
        
        processAgentQueue(agent);
        
        if (typeof triggerStateChange === 'function') {
            triggerStateChange({ type: 'task_completed', taskId, agentId });
        }
    }
}

window.markTaskCompleted = markTaskCompleted;

function shortenCurrentTasks() {
    if (!AppState.simulation.active) return;
    
    AppState.simulation.agents.forEach(agent => {
        if (agent.status === "At Customer" && agent.workTimeout) {
            clearTimeout(agent.workTimeout);
            agent.workTimeout = null;
            
            // Inventory Depletion
            const task = agent.taskQueue[0];
            const simTask = task.tasks && task.tasks.find(tk => tk.id && tk.id.toString().startsWith("SIM-"));
            if (simTask && simTask.requiredParts) {
                for (const [part, qty] of Object.entries(simTask.requiredParts)) {
                    agent.inventory[part] = Math.max(0, (agent.inventory[part] || 0) - qty);
                }
            }

            const completedTask = agent.taskQueue.shift();
            if (completedTask) {
                agent.stats.tasksCompleted++;
                if (!agent.stats.completedTasks) agent.stats.completedTasks = [];
                agent.stats.completedTasks.push(completedTask.id);
            }
            
            if (agent.taskQueuePaths) agent.taskQueuePaths.shift();
            processAgentQueue(agent);
        }
    });
    
    showNotification("Simulation", "All currently active tasks have been fast-forwarded.", "success");
    triggerStateChange({ type: 'tasks_fast_forwarded' });
}

window.shortenCurrentTasks = shortenCurrentTasks;

function updateSimulationClock() {
    const clockDisplay = document.getElementById("simClockDisplay");
    if (!clockDisplay) return;

    const date = new Date(AppState.simulation.time);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    clockDisplay.innerText = `${hours}:${minutes}:${seconds}`;
}

function updateAgentListUI() {
    const list = document.getElementById("agentList");
    if (!list) return;

    list.innerHTML = "";
    
    // Add a container for the "Add Agent" button if it doesn't exist or just append it
    const headerDiv = document.createElement("div");
    headerDiv.className = "p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center";
    headerDiv.innerHTML = `
        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Simulation Agents</span>
        <button id="addAgentBtnRight" class="p-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-sm" title="Add Random Agent">
            <i data-lucide="user-plus" class="w-4 h-4"></i>
        </button>
    `;
    list.appendChild(headerDiv);
    
    const btn = headerDiv.querySelector("#addAgentBtnRight");
    if (btn) btn.onclick = () => addRandomAgent();

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar";
    list.appendChild(scrollContainer);

    AppState.simulation.agents.forEach(agent => {
        const item = document.createElement("div");
        item.className = "agent-item p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-primary-300 transition-all cursor-pointer group";
        
        const targetName = agent.targetCustomer ? agent.targetCustomer.name : "Office";
        const distanceKm = (agent.stats.distanceTraveled / 1000).toFixed(1);
        const fuelLiters = agent.stats.fuelUsed.toFixed(1);
        
        const statusColors = {
            "Idle": "bg-slate-100 text-slate-600",
            "Moving": "bg-blue-100 text-blue-600",
            "At Customer": "bg-emerald-100 text-emerald-600",
            "Returning to Office": "bg-amber-100 text-amber-600",
            "Failed to Route": "bg-red-100 text-red-600"
        };
        const seniorityColors = {
            "Junior": "bg-slate-100 text-slate-500",
            "Intermediate": "bg-blue-50 text-blue-500",
            "Senior": "bg-purple-50 text-purple-600",
            "Lead": "bg-amber-100 text-amber-700"
        };
        const statusClass = statusColors[agent.status] || "bg-slate-100 text-slate-600";
        const seniorityClass = seniorityColors[agent.seniority] || "bg-slate-50 text-slate-400";
        
        item.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white" style="background-color: ${agent.color}">
                        <i data-lucide="navigation" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <div class="font-bold text-slate-800 group-hover:text-primary-600 transition-colors flex items-center gap-2">
                            ${agent.name}
                            <span class="text-[8px] px-1.5 py-0.5 rounded border border-current opacity-70" style="background-color: ${agent.color}15; color: ${agent.color}; border-color: ${agent.color}30;">${agent.seniority}</span>
                        </div>
                        <div class="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${agent.color}"></span>
                            Primary: ${agent.primarySkill}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="edit-agent-btn p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    <span class="text-[10px] px-2 py-0.5 rounded-full ${statusClass} font-bold uppercase tracking-wider">${agent.status}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-3 gap-2 mb-3">
                <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <div class="text-[9px] text-slate-400 font-bold uppercase">Dist</div>
                    <div class="text-xs font-bold text-slate-700">${distanceKm}km</div>
                </div>
                <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <div class="text-[9px] text-slate-400 font-bold uppercase">Fuel</div>
                    <div class="text-xs font-bold text-slate-700">${fuelLiters}L</div>
                </div>
                <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <div class="text-[9px] text-slate-400 font-bold uppercase">Tasks</div>
                    <div class="text-xs font-bold text-emerald-600">${agent.stats.tasksCompleted}</div>
                </div>
            </div>

            <div class="flex flex-wrap gap-1 mb-3">
                ${agent.skills.map(s => `<span class="text-[9px] px-1.5 py-0.5 rounded font-medium" style="background-color: ${agent.color}20; color: ${agent.color}; border: 1px solid ${agent.color}40;">${s}</span>`).join('')}
            </div>
            
            <div class="grid grid-cols-5 gap-1 mb-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                ${Object.entries(agent.inventory).map(([part, qty]) => `
                    <div class="text-center">
                        <div class="text-[7px] text-slate-400 uppercase truncate" title="${part}">${part.replace('_', ' ')}</div>
                        <div class="text-[10px] font-bold ${qty < 3 ? 'text-red-500' : 'text-slate-600'}">${qty}</div>
                    </div>
                `).join('')}
            </div>

            <div class="flex items-center gap-2 text-[11px] text-slate-600 mb-1">
                <i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i>
                <span>Destination: <b class="text-slate-800">${targetName}</b></span>
            </div>
            
            <div class="hidden mt-3 pt-3 border-t border-dashed border-slate-200 space-y-2" id="queue-${agent.id}">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Upcoming Queue</div>
                ${agent.taskQueue.map((t, i) => `
                    <div class="flex items-center gap-2 text-xs ${i === 0 ? 'text-primary-600 font-semibold' : 'text-slate-500'}">
                        <div class="w-4 h-4 rounded-full ${i === 0 ? 'bg-primary-100' : 'bg-slate-100'} flex items-center justify-center text-[9px]">${i + 1}</div>
                        <span class="truncate">${t.name || t.Customer}</span>
                    </div>
                `).join('') || '<div class="text-[10px] text-slate-400 italic">No pending tasks</div>'}
            </div>
        `;
        
        const editBtn = item.querySelector(".edit-agent-btn");
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openEditAgentModal(agent);
        };
        
        item.addEventListener("click", () => {
            const queueDiv = document.getElementById(`queue-${agent.id}`);
            if (queueDiv) {
                const isHidden = queueDiv.classList.contains("hidden");
                if (isHidden) {
                    queueDiv.classList.remove("hidden");
                    item.classList.add("ring-2", "ring-primary-100", "bg-primary-50/10");
                } else {
                    queueDiv.classList.add("hidden");
                    item.classList.remove("ring-2", "ring-primary-100", "bg-primary-50/10");
                }
            }
        });

        scrollContainer.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

function simulateRandomTasks() {
    console.log("Simulating random tasks...");
    if (!AppState.customers) return;

    const randomCustomers = AppState.customers.filter(c => c.lat || c.gps)
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);

    randomCustomers.forEach(cust => {
        const priority = ["Low", "Medium", "High", "Critical"][Math.floor(Math.random() * 4)];
        const isBusiness = Math.random() > 0.8;
        const complexity = ["Low", "Medium", "High"][Math.floor(Math.random() * 3)];
        const lineSize = [1, 2, 4, 8][Math.floor(Math.random() * 4)]; // e.g. 1 core, 2 cores, etc.
        const task = {
            id: `SIM-${Date.now()}-${Math.random()}`,
            Customer: cust.name,
            status: "Pending (Simulated)",
            description: isBusiness ? "Business Support Call" : "Residential Maintenance",
            requiredSkills: [SIM_SKILLS[Math.floor(Math.random() * SIM_SKILLS.length)]],
            requiredParts: { [SIM_PARTS[Math.floor(Math.random() * SIM_PARTS.length)]]: 1 },
            priority: priority,
            isBusiness: isBusiness,
            complexity: complexity,
            lineSize: lineSize,
            createdTime: Date.now() - (Math.random() * 24 * 3600 * 1000), // Created up to 24h ago
            dueBy: Date.now() + (Math.random() * 8 * 3600 * 1000)
        };
        cust.tasks.push(task);
        if (AppState.simulation.tasks) AppState.simulation.tasks.push(task);
        
        const markerData = AppState.customerMarkers.find(m => m.customer.id === cust.id);
        if (markerData) {
            markerData.marker.setIcon(getCustomerIcon(cust));
        }
    });
    showNotification("Tasks Added", "Simulated 5 random maintenance tasks. Redistributing...", "success");
    redistributeAllTasks();
}

function simulateRandomOutage() {
    console.log("Simulating random outage...");
    if (!AppState.towers) return;

    const tower = AppState.towers[Math.floor(Math.random() * AppState.towers.length)];
    if (AppState.simulation.outages) AppState.simulation.outages.push(tower.id);

    // Create Emergency Task for the tower
    const towerTask = {
        id: `SIM-EMERGENCY-${Date.now()}`,
        name: `EMERGENCY: ${tower.site} Outage`,
        Customer: tower.site,
        lat: tower.lat,
        lng: tower.lng,
        gps: `${tower.lat},${tower.lng}`,
        status: "Pending (Simulated)",
        description: "Total Tower Outage - Emergency Repair Required",
        requiredSkills: ['tower_climbing'],
        requiredParts: { 'radio_ubnt': 1, 'poe_injector': 1 },
        priority: "Critical",
        complexity: "High",
        createdTime: Date.now(),
        dueBy: Date.now() + (30 * 60 * 1000) // 30 minutes SLA
    };

    if (AppState.simulation.tasks) AppState.simulation.tasks.push(towerTask);

    const towerMarkerData = AppState.towerMarkers.find(m => m.tower.id === tower.id);
    if (towerMarkerData) {
        towerMarkerData.marker.setOptions({
            opacity: 0.3,
            label: { text: "⚠️", color: "red", fontWeight: "bold" }
        });
    }

    AppState.polylines.forEach(p => {
        if (p.towerId === tower.id) {
            p.polyline.setOptions({ strokeColor: "#FF0000", strokeWeight: 4 });
        }
    });
    
    // Reroute nearest qualified tech immediately
    let nearestTech = null;
    let minDist = Infinity;
    const towerLatLng = new google.maps.LatLng(tower.lat, tower.lng);

    AppState.simulation.agents.forEach(agent => {
        if (agent.skills.includes('tower_climbing')) {
            const dist = google.maps.geometry.spherical.computeDistanceBetween(agent.marker.getPosition(), towerLatLng);
            if (dist < minDist) {
                minDist = dist;
                nearestTech = agent;
            }
        }
    });

    // ADDED: Always add to global sim tasks list
    if (AppState.simulation.tasks) AppState.simulation.tasks.push(towerTask);

    if (nearestTech) {
        showNotification("Emergency Reroute", `Rerouting ${nearestTech.name} to ${tower.site} immediately!`, "error");
        // Pause current task and prepend emergency task
        nearestTech.taskQueue.unshift(towerTask);
        // Reset movement to trigger re-routing to the emergency task
        nearestTech.status = "Idle";
        if (nearestTech.workTimeout) {
            clearTimeout(nearestTech.workTimeout);
            nearestTech.workTimeout = null;
        }
        processAgentQueue(nearestTech);
    } else {
        showNotification("No Qualified Techs", `Tower ${tower.site} is down, but no technicians have the 'tower_climbing' skill!`, "warning");
    }

    // Refresh visibility
    if (typeof updateCustomerMarkerVisibility === 'function') {
        updateCustomerMarkerVisibility();
    }
}

/**
 * NEW: Notification System
 */
function showNotification(title, message, type = "info") {
    const container = document.getElementById("notificationContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `animate__animated animate__fadeInRight`;
    
    let accentColor = "#3b82f6";
    let icon = "info";

    if (type === "warning") {
        accentColor = "#f59e0b";
        icon = "alert-triangle";
    } else if (type === "error") {
        accentColor = "#ef4444";
        icon = "zap-off";
    } else if (type === "success") {
        accentColor = "#10b981";
        icon = "check-circle";
    }

    toast.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-left: 4px solid ${accentColor};
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        width: 320px;
        pointer-events: auto;
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 10px;
    `;

    toast.innerHTML = `
        <div style="color: ${accentColor};">
            <i data-lucide="${icon}" style="width: 20px; height: 20px;"></i>
        </div>
        <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.875rem; color: #1e293b;">${title}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px; line-height: 1.4;">${message}</div>
        </div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
        toast.classList.replace("animate__fadeInRight", "animate__fadeOutRight");
        setTimeout(() => toast.remove(), 1000);
    }, 5000);
}

/**
 * NEW: Coverage Heatmap Simulation
 */
let heatmapCircles = [];
function toggleHeatmap(active) {
    if (!active) {
        heatmapCircles.forEach(c => c.setMap(null));
        heatmapCircles = [];
        return;
    }

    if (!AppState.towers) return;

    AppState.towers.forEach(tower => {
        const circle = new google.maps.Circle({
            strokeColor: "#3b82f6",
            strokeOpacity: 0.1,
            strokeWeight: 1,
            fillColor: "#3b82f6",
            fillOpacity: 0.05,
            map: AppState.map,
            center: { lat: tower.lat, lng: tower.lng },
            radius: 15000 // 15km
        });
        heatmapCircles.push(circle);
    });
    showNotification("Heatmap Active", "Visualizing 15km tower coverage radii.", "info");
}

/**
 * NEW: Storm Event Simulation
 */
function simulateStormEvent() {
    console.log("simulateStormEvent() called");
    if (!AppState.simulation.active) {
        console.warn("Storm simulation failed: Simulation not active");
        showNotification("Simulation Inactive", "Please start simulation mode first.", "warning");
        return;
    }

    if (!AppState.towers || AppState.towers.length === 0) {
        console.warn("Storm simulation failed: No towers in AppState");
        showNotification("No Towers", "No tower data available to simulate storm.", "warning");
        return;
    }

    if (!window.google || !google.maps.geometry) {
        console.error("Storm simulation failed: Google Maps Geometry library not loaded");
        showNotification("Geometry Missing", "Google Maps Geometry library is required.", "error");
        return;
    }

    const centerTower = AppState.towers[Math.floor(Math.random() * AppState.towers.length)];
    console.log(`Storm center picked: ${centerTower.id}`);
    const affectedRadius = 25000;
    
    // Set global storm state for traffic factors
    AppState.simulation.isStorming = true;

    const affectedTowers = AppState.towers.filter(t => {
        if (!window.google || !google.maps.geometry) return false;
        const dist = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(centerTower.lat, centerTower.lng),
            new google.maps.LatLng(t.lat, t.lng)
        );
        return dist <= affectedRadius;
    });

    affectedTowers.forEach(tower => {
        const towerMarkerData = AppState.towerMarkers.find(m => m.tower.id === tower.id);
        if (towerMarkerData) {
            towerMarkerData.marker.setOptions({
                opacity: 0.3,
                label: { text: "⛈️", color: "red", fontWeight: "bold" }
            });
        }
        AppState.polylines.forEach(p => {
            if (p.towerId === tower.id) {
                p.polyline.setOptions({ strokeColor: "#FF0000", strokeOpacity: 0.5 });
            }
        });
    });

    let customerCount = 0;
    if (AppState.customers) {
        AppState.customers.forEach(cust => {
            if (!window.google || !google.maps.geometry) return;
            const coords = getCoords(cust);
            if (!coords) return;

            const dist = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(centerTower.lat, centerTower.lng),
                new google.maps.LatLng(coords.lat, coords.lng)
            );
            
            if (dist <= affectedRadius) {
                customerCount++;
                const stormTask = {
                    id: "SIM-STORM-" + Date.now() + "-" + customerCount,
                    Customer: cust.name,
                    status: "Offline",
                    priority: "High",
                    description: "Storm-related outage",
                    createdTime: Date.now()
                };
                cust.tasks.push(stormTask);
                if (AppState.simulation.tasks) AppState.simulation.tasks.push(stormTask);
                
                const markerData = AppState.customerMarkers.find(m => m.customer.id === cust.id);
                if (markerData) {
                    markerData.marker.setIcon(getCustomerIcon(cust));
                }
            }
        });
    }

    showNotification("Storm Event", `Severe weather affected ${affectedTowers.length} towers and ${customerCount} customers.`, "error");
    if (customerCount > 0) redistributeAllTasks();
}

/**
 * NEW: Advanced Route Optimization using 2-opt algorithm
 */
function solve2Opt(tasks, startPos) {
    if (tasks.length <= 2) return tasks;

    let bestQueue = [...tasks];
    let improved = true;

    // Helper to get distance between two points
    const getDist = (p1, p2) => {
        const c1 = getCoords(p1);
        const c2 = getCoords(p2);
        if (!c1 || !c2) return 0;
        return google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(c1.lat, c1.lng),
            new google.maps.LatLng(c2.lat, c2.lng)
        );
    };

    // Calculate total distance of the route
    const calculateTotalDist = (queue) => {
        let d = 0;
        let last = startPos;
        for (const task of queue) {
            d += getDist(last, task);
            const coords = getCoords(task);
            if (coords) last = new google.maps.LatLng(coords.lat, coords.lng);
        }
        return d;
    };

    let bestDist = calculateTotalDist(bestQueue);

    // Optimization loop
    let iterations = 0;
    const maxIterations = 100; // Safety cap

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 0; i < bestQueue.length - 1; i++) {
            for (let j = i + 1; j < bestQueue.length; j++) {
                // Reverse the segment from i to j
                const newQueue = [
                    ...bestQueue.slice(0, i),
                    ...bestQueue.slice(i, j + 1).reverse(),
                    ...bestQueue.slice(j + 1)
                ];
                
                const newDist = calculateTotalDist(newQueue);
                if (newDist < bestDist) {
                    bestQueue = newQueue;
                    bestDist = newDist;
                    improved = true;
                }
            }
        }
    }
    
    console.log(`2-opt optimized route after ${iterations} iterations. Improvement: ${(bestDist / calculateTotalDist(tasks) * 100).toFixed(1)}% of original`);
    return bestQueue;
}

/**
 * NEW: Route Optimization
 */
function optimizeAgentRoutes() {
    if (!AppState.simulation.active) {
        showNotification("Simulation Inactive", "Please start simulation mode first.", "warning");
        return;
    }

    if (AppState.simulation.agents.length === 0) {
        showNotification("No Agents", "There are no active technicians to optimize.", "warning");
        return;
    }

    let optimizationCount = 0;
    AppState.simulation.agents.forEach(agent => {
        if (agent.taskQueue.length > 1) {
            const currentPos = agent.marker.getPosition();
            
            // Step 1: Start with a greedy baseline
            const greedyQueue = [];
            let remainingTasks = [...agent.taskQueue];
            let lastPos = currentPos;

            while (remainingTasks.length > 0) {
                let closestIndex = -1;
                let minDistance = Infinity;

                remainingTasks.forEach((task, index) => {
                    const coords = getCoords(task);
                    if (!coords) return;
                    const dist = google.maps.geometry.spherical.computeDistanceBetween(
                        lastPos,
                        new google.maps.LatLng(coords.lat, coords.lng)
                    );
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestIndex = index;
                    }
                });

                if (closestIndex !== -1) {
                    const nextTask = remainingTasks.splice(closestIndex, 1)[0];
                    greedyQueue.push(nextTask);
                    const nextCoords = getCoords(nextTask);
                    if (nextCoords) lastPos = new google.maps.LatLng(nextCoords.lat, nextCoords.lng);
                } else {
                    greedyQueue.push(remainingTasks.shift());
                }
            }

            // Step 2: Refine with 2-opt
            agent.taskQueue = solve2Opt(greedyQueue, currentPos);
            
            updateAgentPolyline(agent);
            optimizationCount++;
        }
    });

    if (optimizationCount > 0) {
        showNotification("Route Optimized", `Recalculated routes for ${optimizationCount} agents using VRP optimization.`, "success");
    } else {
        showNotification("Optimization Skipped", "No agents with multiple tasks to optimize.", "info");
    }

    updateAgentListUI();
}

function clearScenarios() {
    console.log("Clearing all scenarios...");
    
    // Clear simulation state but keep active if it was
    const wasActive = AppState.simulation.active;
    
    AppState.simulation.outages = [];
    AppState.simulation.tasks = [];
    AppState.simulation.isStorming = false;
    
    restoreRealData();
    
    if (wasActive) {
        AppState.simulation.active = true; // restoreRealData might have set it to false
        switchToSimulationMode();
    }

    heatmapCircles.forEach(c => c.setMap(null));
    heatmapCircles = [];
    const heatmapCheckbox = document.getElementById("toggleHeatmapCheckbox");
    if (heatmapCheckbox) heatmapCheckbox.checked = false;
    
    // Reset tower markers appearance
    AppState.towerMarkers.forEach(tm => {
        tm.marker.setOptions({
            opacity: 1.0,
            label: null
        });
    });

    // Reset links appearance
    AppState.polylines.forEach(p => {
        p.polyline.setOptions({ strokeColor: "#00FF00", strokeWeight: 2 });
    });

    // Refresh visibility to update customer markers (outage UI fix)
    if (typeof updateCustomerMarkerVisibility === 'function') {
        updateCustomerMarkerVisibility();
    }
    
    showNotification("System Reset", "All simulated data and scenarios cleared.", "success");
}

// ADDED: Export init function for Markers.js
window.initSimulationUI = initSimulationUI;

function updateMarkerIndicators() {
    if (!AppState.simulation.active) return;

    AppState.customerMarkers.forEach(data => {
        const customer = data.customer;
        // Find which agent has this customer in their queue
        const assignedAgent = AppState.simulation.agents.find(a => 
            a.taskQueue.some(t => t.id === customer.id)
        );

        if (assignedAgent) {
            // Apply unique color indicator to marker label or icon
            const currentLabel = data.marker.getLabel();
            if (typeof currentLabel === 'string') {
                data.marker.setLabel({
                    text: currentLabel,
                    color: assignedAgent.color,
                    fontWeight: 'bold',
                    fontSize: '14px'
                });
            } else if (currentLabel) {
                data.marker.setLabel({
                    ...currentLabel,
                    color: assignedAgent.color
                });
            } else {
                data.marker.setLabel({
                    text: "●",
                    color: assignedAgent.color,
                    fontSize: "20px"
                });
            }
        } else {
            // Reset to default
            const currentLabel = data.marker.getLabel();
            if (currentLabel && currentLabel.text === "●") {
                data.marker.setLabel(null);
            } else if (currentLabel) {
                data.marker.setLabel({
                    ...currentLabel,
                    color: "#1e293b"
                });
            }
        }
    });
}

async function generateSimulationReport() {
    console.log("Generating Simulation Report...");
    const agents = AppState.simulation.agents;
    if (!agents || agents.length === 0) return;

    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalAgents: agents.length,
            totalTasksCompleted: agents.reduce((sum, a) => sum + a.stats.tasksCompleted, 0),
            totalDistanceTraveled: agents.reduce((sum, a) => sum + a.stats.distanceTraveled, 0),
            totalFuelUsed: agents.reduce((sum, a) => sum + a.stats.fuelUsed, 0),
            simulationDuration: AppState.simulation.time - agents[0].stats.startTime
        },
        agentStats: agents.map(a => ({
            name: a.name,
            tasksCompleted: a.stats.tasksCompleted,
            distanceTraveled: a.stats.distanceTraveled,
            fuelUsed: a.stats.fuelUsed,
            skills: a.skills,
            remainingInventory: a.inventory
        }))
    };

    console.log("Simulation Report Summary:", report.summary);

    try {
        const response = await fetch('/api/simulation/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });
        if (response.ok) {
            const result = await response.json();
            showNotification("Report Saved", `Simulation report saved as ${result.filename}`, "success");
        }
    } catch (err) {
        console.error("Failed to save simulation report:", err);
    }
}

