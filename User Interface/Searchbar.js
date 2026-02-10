function initSearchFilter() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  let debounceTimer;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      AppState.filters.query = e.target.value.trim().toLowerCase();
      
      // ADDED: Trigger centralized visibility update (which now also updates links)
      if (typeof updateCustomerMarkerVisibility === 'function') {
        updateCustomerMarkerVisibility();
      }
    }, 150); // debounce delay
  });
}
