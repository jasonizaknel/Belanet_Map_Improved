async function fetchAdministrators() {
    try {
        const token = window.AppState && window.AppState.config ? window.AppState.config.adminToken : '';
        const response = await fetch('/api/administrators', {
            headers: { 'X-Admin-Token': token }
        });
        const data = await response.json();
        window.AppState.team.administrators = data;
        renderAdminDropdown();
    } catch (error) {
        console.error('Failed to fetch administrators:', error);
    }
}

function renderAdminDropdown() {
    const dropdown = document.getElementById('adminDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';
    window.AppState.team.administrators.forEach(admin => {
        const btn = document.createElement('button');
        btn.textContent = admin.name;
        btn.onclick = () => {
            addTeamMember(admin);
            dropdown.classList.add('hidden');
        };
        dropdown.appendChild(btn);
    });

    if (window.AppState.team.administrators.length === 0) {
        const div = document.createElement('div');
        div.className = 'p-4 text-sm text-gray-500 italic';
        div.textContent = 'No administrators found';
        dropdown.appendChild(div);
    }
}

function addTeamMember(admin) {
    if (window.AppState.team.members.find(m => m.id === admin.id)) {
        return; // Already added
    }

    const member = {
        ...admin,
        status: 'Active',
        addedAt: new Date().toISOString()
    };

    window.AppState.team.members.push(member);
    saveTeamMembers();
    renderTeamMembers();
}

function saveTeamMembers() {
    localStorage.setItem('belanet_team_members', JSON.stringify(window.AppState.team.members));
}

function loadTeamMembers() {
    const saved = localStorage.getItem('belanet_team_members');
    if (saved) {
        window.AppState.team.members = JSON.parse(saved);
        renderTeamMembers();
    }
}

function renderTeamMembers() {
    const list = document.getElementById('teamMemberList');
    if (!list) return;

    list.innerHTML = '';
    window.AppState.team.members.forEach(member => {
        const card = document.createElement('div');
        card.className = 'member-card flex items-center gap-4 group relative';
        card.innerHTML = `
            <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                <i data-lucide="user" class="w-6 h-6"></i>
            </div>
            <div class="flex-1">
                <div class="font-bold text-slate-800">${member.name}</div>
                <div class="text-xs text-green-500 font-medium">Online</div>
            </div>
            <div class="flex items-center gap-2">
                <button class="remove-member-btn opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 transition-all" title="Remove Member">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
                <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>
            </div>
        `;
        
        card.onclick = (e) => {
            if (e.target.closest('.remove-member-btn')) {
                removeTeamMember(member.id);
            } else {
                showMemberDetails(member);
            }
        };
        list.appendChild(card);
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function removeTeamMember(memberId) {
    window.AppState.team.members = window.AppState.team.members.filter(m => m.id !== memberId);
    saveTeamMembers();
    renderTeamMembers();
    
    // If we are viewing this member's details, close them
    if (window.AppState.team.activeMemberId === memberId) {
        const details = document.getElementById('memberDetails');
        if (details) details.classList.add('hidden');
        document.getElementById('rightSidebar').classList.remove('expanded');
        document.getElementById('app').classList.remove('right-sidebar-expanded');
    }
}

function clearTeamMembers() {
    if (confirm('Are you sure you want to clear all team members?')) {
        window.AppState.team.members = [];
        saveTeamMembers();
        renderTeamMembers();
        
        const details = document.getElementById('memberDetails');
        if (details) details.classList.add('hidden');
        document.getElementById('rightSidebar').classList.remove('expanded');
        document.getElementById('app').classList.remove('right-sidebar-expanded');
    }
}

function showMemberDetails(member) {
    window.AppState.team.activeMemberId = member.id;
    const details = document.getElementById('memberDetails');
    const nameEl = document.getElementById('detailMemberName');
    
    if (details && nameEl) {
        nameEl.textContent = member.name;
        details.classList.remove('hidden');
        details.classList.add('animate__animated', 'animate__slideInRight');
        
        // Update Info Tab
        updateMemberStats(member);
        
        // Show Auto Assign container if we are in Info/Tasks tab
        const autoAssignContainer = document.getElementById('autoAssignContainer');
        if (autoAssignContainer) autoAssignContainer.classList.remove('hidden');
    }
}

function updateMemberStats(member) {
    const tasks = window.AppState.tasks || [];
    
    // Filter tasks assigned to this member that are NOT closed/resolved
    const memberTasks = tasks.filter(t => {
        const isAssigned = (t.assignee && String(t.assignee) === String(member.id)) || 
                           (t["Assigned to"] && String(t["Assigned to"]).toLowerCase() === String(member.name).toLowerCase());
        
        if (!isAssigned) return false;
        
        // Use getTaskStatusLabel from Markers.js (global)
        const status = typeof getTaskStatusLabel === 'function' ? getTaskStatusLabel(t) : (t.Status || 'Active');
        
        // Filter out closed and resolved tasks to avoid "ghost" tasks
        return status !== "Closed" && status !== "Resolved" && status !== "Rejected";
    });

    const taskCountEl = document.getElementById('infoTaskCount');
    if (taskCountEl) taskCountEl.textContent = memberTasks.length;

    const trackers = window.AppState.trackerPositions || [];
    const technicianTracker = trackers.find(tr => 
        tr.attributes && tr.attributes.name && 
        tr.attributes.name.toLowerCase().includes(member.name.toLowerCase())
    );

    const vehicleEl = document.getElementById('infoVehicle');
    let techPos = null;
    if (vehicleEl) {
        vehicleEl.textContent = technicianTracker ? (technicianTracker.attributes.name || technicianTracker.name || "Tracked") : "None";
        if (technicianTracker) {
            techPos = { lat: technicianTracker.latitude, lng: technicianTracker.longitude };
        }
    }

    // Render Tasks Tab List with tech position for distance calculation
    renderMemberTasks(memberTasks, techPos);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function renderMemberTasks(memberTasks, techPos) {
    const list = document.getElementById('memberTaskList');
    if (!list) return;

    list.innerHTML = '';
    if (memberTasks.length === 0) {
        list.innerHTML = '<div class="text-sm text-gray-500 italic p-4 text-center">No tasks assigned</div>';
        return;
    }

    memberTasks.forEach(task => {
        // Find customer location
        let distanceHtml = '';
        let customer = null;
        if (window.AppState.customers) {
            const customerId = task.related_customer_id || task.customer_id;
            if (task.Customer) {
                customer = window.AppState.customers.find(c => c.name === task.Customer);
            } else if (customerId) {
                customer = window.AppState.customers.find(c => String(c.id) === String(customerId));
            }
            
            if (customer && customer.gps && techPos) {
                const parts = customer.gps.split(',').map(Number);
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    const dist = calculateDistance(techPos.lat, techPos.lng, parts[0], parts[1]);
                    distanceHtml = `
                        <div class="flex items-center gap-1 text-emerald-600 font-bold">
                            <i data-lucide="map-pin" class="w-3 h-3"></i>
                            <span>${dist.toFixed(1)} km</span>
                        </div>
                    `;
                }
            }
        }

        const statusLabel = typeof getTaskStatusLabel === 'function' ? getTaskStatusLabel(task) : (task.Status || 'N/A');

        const item = document.createElement('div');
        item.className = 'p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-primary-300 transition-all group';
        item.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">#${task.ID || task.id}</span>
                <span class="text-xs font-medium text-gray-400">${statusLabel}</span>
            </div>
            <div class="font-bold text-slate-800 mb-1">${task.Title || task.subject || 'No Title'}</div>
            <div class="text-xs text-slate-500 line-clamp-2 mb-3">${task.Description || 'No description'}</div>
            
            <div class="pt-3 border-t border-gray-50 flex items-center justify-between">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <i data-lucide="message-square" class="w-3 h-3 text-gray-400"></i>
                        </div>
                        <span class="text-[10px] text-gray-400 font-medium">Last comment: Just now</span>
                    </div>
                    ${distanceHtml}
                </div>
                <div class="flex gap-2">
                    ${customer ? `
                        <button class="view-on-map-btn p-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors" title="View on Map">
                            <i data-lucide="map" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                    <button class="p-2 text-gray-300 hover:text-primary-500 transition-colors" title="Open in Splynx">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;

        if (customer) {
            const btn = item.querySelector('.view-on-map-btn');
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    viewTaskOnMap(customer);
                };
            }
        }

        list.appendChild(item);
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function viewTaskOnMap(customer) {
    if (!customer || !customer.gps) return;
    const parts = customer.gps.split(',').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return;

    if (window.AppState.map) {
        window.AppState.map.setCenter({ lat: parts[0], lng: parts[1] });
        window.AppState.map.setZoom(16);
        
        // Find marker and open its info window
        const markerData = window.AppState.customerMarkers.find(m => m.customer.id === customer.id);
        if (markerData) {
            if (typeof showCustomerInfoWindow === 'function') {
                showCustomerInfoWindow(markerData);
            }
        }
    }
}


async function handleAutoAssign() {
    const activeId = window.AppState.team.activeMemberId;
    if (!activeId) return;
    
    const member = window.AppState.team.members.find(m => m.id === activeId);
    if (!member) return;

    const textarea = document.getElementById('autoAssignInput');
    const input = textarea ? textarea.value : "";
    if (!input) {
        if (typeof showNotification === 'function') {
            showNotification("Missing Input", "Please enter at least one Task ID", "warning");
        } else {
            alert("Please enter at least one Task ID");
        }
        return;
    }

    const taskIds = input.split(',').map(id => id.trim()).filter(id => id);
    if (taskIds.length === 0) return;

    // Show loading state if possible
    const confirmBtn = document.getElementById('confirmAutoAssign');
    const originalText = confirmBtn ? confirmBtn.textContent : "Apply";
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Assigning...";
    }

    try {
        const token = window.AppState && window.AppState.config ? window.AppState.config.adminToken : '';
        const response = await fetch('/api/tasks/assign', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Admin-Token': token
            },
            body: JSON.stringify({
                taskIds: taskIds,
                technicianId: member.id,
                technicianName: member.name
            })
        });

        const result = await response.json();
        
        // Hide UI and clear input
        toggleAutoAssignUI(false);
        if (textarea) textarea.value = "";

        // Summarize results
        const successCount = result.results.filter(r => r.assigned).length;
        const failCount = result.results.length - successCount;

        if (typeof showNotification === 'function') {
            if (failCount === 0) {
                showNotification("Success", `Successfully assigned ${successCount} tasks to ${member.name}`, "success");
            } else {
                showNotification("Assignment Partial", `Assigned ${successCount} tasks, ${failCount} failed.`, "warning");
            }
        } else {
            alert(`Assigned ${successCount} tasks to ${member.name}. ${failCount} failed.`);
        }
        
        // Refresh EVERYTHING to ensure tasks are updated
        // We need to fetch tasks again from the server if possible, or update local state
        if (typeof fetchTasks === 'function') {
            await fetchTasks();
        }
        
        // Refresh member stats and list
        updateMemberStats(member);
        
    } catch (error) {
        console.error('Auto-assign failed:', error);
        if (typeof showNotification === 'function') {
            showNotification("Error", "Failed to assign tasks. Check connection.", "error");
        } else {
            alert('Failed to assign tasks. Check console for details.');
        }
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
        }
    }
}

function toggleAutoAssignUI(show) {
    const ui = document.getElementById('autoAssignUI');
    const btn = document.getElementById('toggleAutoAssignUI');
    if (!ui || !btn) return;

    if (show === undefined) show = ui.classList.contains('hidden');
    
    if (show) {
        ui.classList.remove('hidden');
        btn.classList.add('hidden');
    } else {
        ui.classList.add('hidden');
        btn.classList.remove('hidden');
    }
}

function initRightSidebarResize() {
    const dragHandle = document.getElementById("rightDragBar");
    const sidebar = document.getElementById("rightSidebar");

    let dragging = false;

    const onMouseMove = (e) => {
        if (!dragging) return;

        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 120 && newWidth <= 800) {
            sidebar.style.width = `${newWidth}px`;
            const toggleBtn = document.getElementById("rightToggleBtn");
            if (toggleBtn) {
                toggleBtn.style.right = `${newWidth}px`;
            }
        }
    };

    const stopDragging = () => {
        dragging = false;
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", stopDragging);
    };

    dragHandle.addEventListener("mousedown", () => {
        dragging = true;
        document.body.style.cursor = "ew-resize";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", stopDragging);
    });
}

function initRightSidebarToggle() {
    const toggleBtn = document.getElementById("rightToggleBtn");
    const sidebar = document.getElementById("rightSidebar");

    if (!toggleBtn) return;

    // Initialize position
    if (sidebar.classList.contains('collapsed')) {
        toggleBtn.style.right = '0';
    } else {
        toggleBtn.style.right = sidebar.style.width || '300px';
    }

    toggleBtn.addEventListener("click", () => {
        const isCollapsed = sidebar.classList.toggle("collapsed");
        toggleBtn.classList.toggle("active", isCollapsed);
        if (isCollapsed) {
            toggleBtn.style.right = '0';
        } else {
            toggleBtn.style.right = sidebar.style.width || '300px';
        }
    });
}

function initTeamUI() {
    const addMemberBtn = document.getElementById('addMemberBtn');
    const adminDropdown = document.getElementById('adminDropdown');
    const backBtn = document.getElementById('backToTeamBtn');
    const sidebar = document.getElementById('rightSidebar');
    const toggleAutoAssignUIBtn = document.getElementById('toggleAutoAssignUI');
    const confirmAutoAssignBtn = document.getElementById('confirmAutoAssign');
    const cancelAutoAssignBtn = document.getElementById('cancelAutoAssign');
    const clearTeamBtn = document.getElementById('clearTeamBtn');

    if (addMemberBtn && adminDropdown) {
        addMemberBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            adminDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            adminDropdown.classList.add('hidden');
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const details = document.getElementById('memberDetails');
            details.classList.add('hidden');
            sidebar.classList.remove('expanded');
            document.getElementById('app').classList.remove('right-sidebar-expanded');
            window.AppState.team.expandedSidebar = false;
            
            const autoAssignContainer = document.getElementById('autoAssignContainer');
            if (autoAssignContainer) autoAssignContainer.classList.add('hidden');
            
            // Also reset auto-assign UI
            toggleAutoAssignUI(false);
            
            // Turn off bulk select mode
            window.AppState.bulkSelectMode = false;
            const toggleBulkSelectBtn = document.getElementById('toggleBulkSelect');
            if (toggleBulkSelectBtn) {
                toggleBulkSelectBtn.classList.remove('bg-purple-600', 'text-white');
            }
            const hint = document.getElementById('bulkSelectHint');
            if (hint) hint.classList.add('hidden');
        });
    }

    if (toggleAutoAssignUIBtn) {
        toggleAutoAssignUIBtn.addEventListener('click', () => toggleAutoAssignUI(true));
    }

    const toggleBulkSelectBtn = document.getElementById('toggleBulkSelect');
    if (toggleBulkSelectBtn) {
        toggleBulkSelectBtn.addEventListener('click', () => {
            window.AppState.bulkSelectMode = !window.AppState.bulkSelectMode;
            toggleBulkSelectBtn.classList.toggle('bg-purple-600', window.AppState.bulkSelectMode);
            toggleBulkSelectBtn.classList.toggle('text-white', window.AppState.bulkSelectMode);
            
            const hint = document.getElementById('bulkSelectHint');
            if (hint) hint.classList.toggle('hidden', !window.AppState.bulkSelectMode);
            
            if (window.AppState.bulkSelectMode) {
                toggleAutoAssignUI(true);
                if (typeof showNotification === 'function') {
                    showNotification("Bulk Select Active", "Click customers on map to add their tasks.", "info");
                }
            }
        });
    }

    if (confirmAutoAssignBtn) {
        confirmAutoAssignBtn.addEventListener('click', handleAutoAssign);
    }

    if (cancelAutoAssignBtn) {
        cancelAutoAssignBtn.addEventListener('click', () => toggleAutoAssignUI(false));
    }

    if (clearTeamBtn) {
        clearTeamBtn.addEventListener('click', clearTeamMembers);
    }

    const detailTabs = document.querySelectorAll('.detail-tab-btn');
    detailTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            detailTabs.forEach(t => {
                t.classList.remove('active', 'border-primary-500', 'text-primary-600');
                t.classList.add('border-transparent', 'text-gray-500');
            });
            tab.classList.add('active', 'border-primary-500', 'text-primary-600');
            tab.classList.remove('border-transparent', 'text-gray-500');

            // Expand sidebar
            sidebar.classList.add('expanded');
            document.getElementById('app').classList.add('right-sidebar-expanded');
            window.AppState.team.expandedSidebar = true;
            
            // Hide other content
            document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.add('hidden'));
            const target = tab.getAttribute('data-tab');
            const content = document.getElementById(`member${target.charAt(0).toUpperCase() + target.slice(1)}Content`);
            if (content) content.classList.remove('hidden');
        });
    });
}

function addTasksToAssignment(taskIdsString) {
    const sidebar = document.getElementById('rightSidebar');
    const toggleBtn = document.getElementById('rightToggleBtn');
    const textarea = document.getElementById('autoAssignInput');
    
    // 1. Open sidebar if collapsed
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        if (toggleBtn) {
            toggleBtn.classList.remove('active');
            toggleBtn.style.right = sidebar.style.width || '300px';
        }
    }

    // 2. If no member is active, warn user
    if (!window.AppState.team.activeMemberId) {
        if (typeof showNotification === 'function') {
            showNotification("Select Technician", "Please select a technician first to assign tasks to.", "info");
        } else {
            alert("Please select a technician first to assign tasks to.");
        }
        return;
    }

    // 3. Show Auto Assign UI
    toggleAutoAssignUI(true);

    // 4. Append IDs to textarea
    if (textarea) {
        const currentVal = textarea.value.trim();
        const newIds = taskIdsString.split(',');
        let finalIds = currentVal ? currentVal.split(',').map(id => id.trim()) : [];
        
        newIds.forEach(id => {
            if (!finalIds.includes(id)) {
                finalIds.push(id);
            }
        });
        
        textarea.value = finalIds.join(', ');
        textarea.focus();
        
        // Visual feedback
        textarea.classList.add('ring-2', 'ring-purple-500');
        setTimeout(() => textarea.classList.remove('ring-2', 'ring-purple-500'), 1000);
    }
}

window.addTasksToAssignment = addTasksToAssignment;

document.addEventListener("DOMContentLoaded", () => {
    initRightSidebarResize();
    initRightSidebarToggle();
    initTeamUI();
    loadTeamMembers();
    
    // If config is already loaded, fetch admins immediately, otherwise wait for event
    if (window.AppState && window.AppState.config && window.AppState.config.adminToken) {
        fetchAdministrators();
    } else {
        window.addEventListener('configLoaded', () => {
            fetchAdministrators();
        });
    }
});
