function initSidebarResize() {
  const dragHandle = document.getElementById("dragBar");
  const sidebar = document.getElementById("sidebar");

  let dragging = false;

  const onMouseMove = (e) => {
    if (!dragging) return;

    const newWidth = e.clientX;
    if (newWidth >= 120 && newWidth <= 600) {
      sidebar.style.width = `${newWidth}px`;
      const toggleBtn = document.getElementById("toggleBtn");
      if (toggleBtn) {
        toggleBtn.style.left = `${newWidth}px`;
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

// FIXED: Added missing collapse/toggle button handler
function initSidebarToggle() {
  const toggleBtn = document.getElementById("toggleBtn");
  const sidebar = document.getElementById("sidebar");

  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const isCollapsed = sidebar.classList.toggle("collapsed");
    toggleBtn.classList.toggle("active", isCollapsed);
    if (isCollapsed) {
        toggleBtn.style.left = '0';
    } else {
        toggleBtn.style.left = sidebar.style.width || '320px';
    }
  });
}

// ADDED: Initialize filter buttons for customers and towers
function initFilterButtons() {
  const customersBtn = document.getElementById("toggleCustomersBtn");
  const towersBtn = document.getElementById("toggleTowersBtn");
  const linksBtn = document.getElementById("toggleLinksBtn");
  const trackersBtn = document.getElementById("toggleTrackersBtn");
  const weatherBtn = document.getElementById("toggleWeatherBtn");

  if (!customersBtn || !towersBtn) return;

  // Set initial states based on AppState
  customersBtn.classList.toggle("active", !!AppState.visibility.customers);
  towersBtn.classList.toggle("active", !!AppState.visibility.towers);
  if (linksBtn) linksBtn.classList.toggle("active", !!AppState.visibility.links);
  if (trackersBtn) trackersBtn.classList.toggle("active", !!AppState.visibility.trackers);
  if (weatherBtn) weatherBtn.classList.toggle("active", !!AppState.visibility.weather);

  customersBtn.addEventListener("click", () => {
    toggleCustomers();
    customersBtn.classList.toggle("active", AppState.visibility.customers);
  });

  towersBtn.addEventListener("click", () => {
    toggleTowers();
    towersBtn.classList.toggle("active", AppState.visibility.towers);
  });

  if (linksBtn) {
    linksBtn.addEventListener("click", () => {
      toggleLinks();
      linksBtn.classList.toggle("active", AppState.visibility.links);
    });
  }

  if (trackersBtn) {
    trackersBtn.addEventListener("click", () => {
      toggleTrackers();
      trackersBtn.classList.toggle("active", AppState.visibility.trackers);
    });
  }

  if (weatherBtn) {
    weatherBtn.addEventListener("click", async () => {
      await toggleWeather();
      weatherBtn.classList.toggle("active", AppState.visibility.weather);
    });
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll(".tabBtn");
  const tabContents = document.querySelectorAll(".tabContent");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");

      tabButtons.forEach((btn) => {
        btn.classList.remove("active");
      });

      tabContents.forEach((content) => {
        content.classList.remove("active");
      });

      button.classList.add("active");
      const targetContent = document.getElementById(`${targetTab}Tab`);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // Set initial active tab if none is active
  if (!document.querySelector(".tabBtn.active")) {
    tabButtons[0]?.click();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initSidebarResize();
  // FIXED: Initialize toggle button
  initSidebarToggle();
  // ADDED: Initialize filter buttons
  initFilterButtons();
  // ADDED: Initialize tabs
  initTabs();
});