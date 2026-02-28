(function () {
  "use strict";

  const enabledToggle = document.getElementById("enabled-toggle");
  const modeAutoBtn = document.getElementById("mode-auto");
  const modeManualBtn = document.getElementById("mode-manual");
  const repoListEl = document.getElementById("repo-list");
  const emptyState = document.getElementById("empty-state");
  const resetBtn = document.getElementById("reset-btn");

  let currentMode = "auto";
  let repoColors = {};
  let detectedRepos = [];

  let _syncWriteTimer = null;
  function debouncedSyncWrite(data) {
    clearTimeout(_syncWriteTimer);
    _syncWriteTimer = setTimeout(function () {
      chrome.storage.sync.set(data);
    }, 80);
  }

  function loadSettings() {
    chrome.storage.sync.get(
      { mode: "auto", repoColors: {}, enabled: true },
      function (sync) {
        if (chrome.runtime.lastError) return;

        currentMode = sync.mode;
        repoColors = sync.repoColors || {};
        enabledToggle.checked = sync.enabled;

        updateModeButtons();

        chrome.storage.local.get({ detectedRepos: [] }, function (local) {
          if (chrome.runtime.lastError) return;
          detectedRepos = local.detectedRepos || [];
          renderRepoList();
        });
      }
    );
  }

  function updateModeButtons() {
    modeAutoBtn.classList.toggle("active", currentMode === "auto");
    modeManualBtn.classList.toggle("active", currentMode === "manual");
  }

  function renderRepoList() {
    // Clear existing repo rows (keep empty state)
    const existing = repoListEl.querySelectorAll(".repo-row");
    for (const el of existing) el.remove();

    if (detectedRepos.length === 0) {
      emptyState.style.display = "";
      return;
    }

    emptyState.style.display = "none";

    const sorted = [...detectedRepos].sort();
    for (const repo of sorted) {
      const color =
        currentMode === "manual" && repoColors[repo]
          ? repoColors[repo]
          : getAutoColor(repo);

      const row = document.createElement("div");
      row.className = "repo-row";

      const swatch = document.createElement("div");
      swatch.className = "color-swatch";

      const picker = document.createElement("input");
      picker.type = "color";
      picker.value = color;

      const fill = document.createElement("div");
      fill.className = "swatch-fill";
      fill.style.backgroundColor = color;

      picker.addEventListener("input", function () {
        // Live preview only — no storage write during drag
        if (currentMode === "auto") {
          currentMode = "manual";
          updateModeButtons();
        }
        fill.style.backgroundColor = picker.value;
        repoColors[repo] = picker.value;
      });

      picker.addEventListener("change", function () {
        // Write to storage once when the picker is closed/committed
        debouncedSyncWrite({ mode: currentMode, repoColors: repoColors });
      });

      swatch.appendChild(picker);
      swatch.appendChild(fill);

      const name = document.createElement("span");
      name.className = "repo-name";
      name.textContent = repo;

      row.appendChild(swatch);
      row.appendChild(name);
      repoListEl.appendChild(row);
    }
  }

  // Enable/disable toggle
  enabledToggle.addEventListener("change", function () {
    chrome.storage.sync.set({ enabled: enabledToggle.checked });
  });

  // Mode buttons
  modeAutoBtn.addEventListener("click", function () {
    currentMode = "auto";
    updateModeButtons();
    chrome.storage.sync.set({ mode: "auto" });
    renderRepoList();
  });

  modeManualBtn.addEventListener("click", function () {
    currentMode = "manual";
    updateModeButtons();
    chrome.storage.sync.set({ mode: "manual" });
    renderRepoList();
  });

  // Reset button
  resetBtn.addEventListener("click", function () {
    repoColors = {};
    chrome.storage.sync.set({ repoColors: {} });
    renderRepoList();
  });

  loadSettings();
})();
