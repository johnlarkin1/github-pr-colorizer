(function () {
  "use strict";

  const ATTR = "data-pr-colorizer";
  let _prevDetectedRepos = null;

  function getThemeOpacity() {
    const mode = document.documentElement.getAttribute("data-color-mode");
    return mode === "dark" ? 0.18 : 0.14;
  }

  function findPrRows() {
    const selectors = [
      ".js-issue-row",
      ".Box-row",
      '[data-testid="list-view-item"]',
      ".js-navigation-item",
    ];
    for (const sel of selectors) {
      const rows = document.querySelectorAll(sel);
      if (rows.length > 0) return rows;
    }
    return [];
  }

  const NON_REPO_PREFIXES = new Set([
    "orgs", "settings", "notifications", "explore", "topics",
    "trending", "collections", "sponsors", "login", "signup",
    "features", "marketplace", "pricing", "enterprise", "team",
  ]);

  function extractRepoName(row) {
    try {
      // Strategy 1: PR link pattern /<owner>/<repo>/pull/<num> — most specific
      const allLinks = row.querySelectorAll("a[href]");
      for (const a of allLinks) {
        const match = a.getAttribute("href").match(/^\/([^/]+)\/([^/]+)\/pull\/\d+/);
        if (match) return match[1] + "/" + match[2];
      }

      // Strategy 2: anchor with data-hovercard-type="repository" — GitHub semantic marker
      const hovercard = row.querySelector('a[data-hovercard-type="repository"]');
      if (hovercard) {
        const href = hovercard.getAttribute("href");
        const parts = href.split("/").filter(Boolean);
        if (parts.length >= 2) return parts[0] + "/" + parts[1];
      }

      // Strategy 3: anchor text matching owner/repo regex — visible text is reliable
      for (const a of allLinks) {
        const text = a.textContent.trim();
        if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(text) && !text.includes(" ")) {
          return text;
        }
      }

      // Strategy 4: 2-segment path fallback with stricter validation
      const repoLinks = row.querySelectorAll('a[href^="/"]');
      for (const a of repoLinks) {
        const href = a.getAttribute("href");
        const parts = href.split("/").filter(Boolean);
        if (
          parts.length === 2 &&
          !href.includes("/pulls") &&
          !href.includes("/issues") &&
          !NON_REPO_PREFIXES.has(parts[0].toLowerCase())
        ) {
          return parts.join("/");
        }
      }
    } catch (e) {
      // Graceful null return
    }
    return null;
  }

  function colorizeRows(settings) {
    try {
      if (!settings.enabled) {
        clearColors();
        return;
      }

      const rows = findPrRows();
      const opacity = getThemeOpacity();
      const detectedRepos = new Set();

      for (const row of rows) {
        const repo = extractRepoName(row);
        if (!repo) continue;

        detectedRepos.add(repo);

        let color;
        if (settings.mode === "manual" && settings.repoColors && settings.repoColors[repo]) {
          color = settings.repoColors[repo];
        } else {
          color = getAutoColor(repo);
        }

        row.style.backgroundColor = hexToRgba(color, opacity);
        row.style.borderLeft = `4px solid ${color}`;
        row.setAttribute(ATTR, repo);
      }

      // Store detected repos for popup only when the set changes
      if (detectedRepos.size > 0) {
        const sorted = [...detectedRepos].sort();
        const key = sorted.join("\n");
        if (key !== _prevDetectedRepos) {
          _prevDetectedRepos = key;
          chrome.storage.local.set({ detectedRepos: sorted });
        }
      }
    } catch (e) {
      console.error("[PR Colorizer]", e);
    }
  }

  function clearColors() {
    const rows = document.querySelectorAll(`[${ATTR}]`);
    for (const row of rows) {
      row.style.backgroundColor = "";
      row.style.borderLeft = "";
      row.removeAttribute(ATTR);
    }
  }

  function loadSettingsAndColorize() {
    try {
      chrome.storage.sync.get(
        { mode: "auto", repoColors: {}, enabled: true },
        function (settings) {
          if (chrome.runtime.lastError) {
            console.error("[PR Colorizer]", chrome.runtime.lastError);
            return;
          }
          colorizeRows(settings);
        }
      );
    } catch (e) {
      console.error("[PR Colorizer]", e);
    }
  }

  // Debounced version for high-frequency triggers
  let _colorizeTimer = null;
  function debouncedLoadSettingsAndColorize() {
    clearTimeout(_colorizeTimer);
    _colorizeTimer = setTimeout(loadSettingsAndColorize, 100);
  }

  // Initial colorize
  loadSettingsAndColorize();

  // Turbo Drive full navigation — infrequent, respond immediately
  document.addEventListener("turbo:load", function () {
    loadSettingsAndColorize();
  });

  // GitHub soft navigation — infrequent, respond immediately
  document.addEventListener("soft-nav:end", function () {
    loadSettingsAndColorize();
  });

  // MutationObserver for dynamic DOM updates (infinite scroll, AJAX) — debounced
  const mainEl = document.querySelector("main") || document.body;
  const observer = new MutationObserver(function (mutations) {
    let hasNewNodes = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    if (hasNewNodes) {
      debouncedLoadSettingsAndColorize();
    }
  });
  observer.observe(mainEl, { childList: true, subtree: true });

  // Re-colorize when settings change from popup — debounced
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "sync") {
      debouncedLoadSettingsAndColorize();
    }
  });
})();
