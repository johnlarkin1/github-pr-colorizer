(function () {
  "use strict";

  const ATTR = "data-pr-colorizer";
  let _prevDetectedRepos = null;

  // Only colorize list pages. Guards against the /*/issues* match pattern, which
  // also covers issue detail pages. Re-checked on every colorize — soft navigation
  // changes the path without a reload.
  const LIST_PAGE = /^\/(pulls|issues)(\/|$)|^\/[^/]+\/[^/]+\/(pulls|issues)\/?$/;

  function getThemeOpacity() {
    // data-color-mode is "auto" | "light" | "dark"; "auto" defers to the OS
    const mode = document.documentElement.getAttribute("data-color-mode");
    const isDark =
      mode === "dark" ||
      (mode === "auto" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    return isDark ? 0.18 : 0.14;
  }

  function findPrRows() {
    // New React ListView UI. The row is an <li>, but only sometimes a direct child
    // of the <ul>: /pulls/* nests it directly, /issues* wraps it in a <div>. Take
    // the outermost <li> under the list to cover both. Never select on the
    // ListItem-module__* classes — those hashes rotate on every GitHub deploy.
    const listViewRows = [
      ...document.querySelectorAll(
        'ul[data-listview-component="items-list"] li'
      ),
    ].filter((li) => !li.parentElement.closest("li"));
    if (listViewRows.length > 0) return listViewRows;

    // Legacy server-rendered UI (still serving repo-scoped /owner/repo/pulls)
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

  const PULL_OR_ISSUE_PATH = /^\/([^/]+)\/([^/]+)\/(?:pull|issues)\/\d+/;

  // Read a.pathname rather than the href attribute: /pulls/* renders absolute
  // hrefs (https://github.com/owner/repo/pull/1) while /issues* renders relative
  // ones, and pathname normalizes both. Skip off-site links.
  function sameOriginPath(a) {
    if (a.hostname && a.hostname !== location.hostname) return null;
    return a.pathname;
  }

  function extractRepoName(row) {
    try {
      // Strategy 1: pull/issue link path /<owner>/<repo>/(pull|issues)/<num> — most specific
      const allLinks = row.querySelectorAll("a[href]");
      for (const a of allLinks) {
        const path = sameOriginPath(a);
        if (!path) continue;
        const match = path.match(PULL_OR_ISSUE_PATH);
        if (match) return match[1] + "/" + match[2];
      }

      // Strategy 2: data-hovercard-url — always relative, even when href is absolute.
      // On the new UI the title link is the row's only anchor, so this is the sole fallback.
      const hovercardUrl = row.querySelector("a[data-hovercard-url]");
      if (hovercardUrl) {
        const match = hovercardUrl
          .getAttribute("data-hovercard-url")
          .match(/^\/([^/]+)\/([^/]+)\//);
        if (match) return match[1] + "/" + match[2];
      }

      // Strategy 3: anchor with data-hovercard-type="repository" — GitHub semantic marker
      const hovercard = row.querySelector('a[data-hovercard-type="repository"]');
      if (hovercard) {
        const href = hovercard.getAttribute("href");
        const parts = href.split("/").filter(Boolean);
        if (parts.length >= 2) return parts[0] + "/" + parts[1];
      }

      // Strategy 4: anchor text matching owner/repo regex — visible text is reliable
      for (const a of allLinks) {
        const text = a.textContent.trim();
        if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(text) && !text.includes(" ")) {
          return text;
        }
      }

      // Strategy 5: 2-segment path fallback with stricter validation
      for (const a of allLinks) {
        const path = sameOriginPath(a);
        if (!path) continue;
        const parts = path.split("/").filter(Boolean);
        if (
          parts.length === 2 &&
          !path.includes("/pulls") &&
          !path.includes("/issues") &&
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
      if (!settings.enabled || !LIST_PAGE.test(location.pathname)) {
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
    _colorizeTimer = setTimeout(loadSettingsAndColorize, 30);
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

  // Instant preview when popup sends direct color updates (bypasses storage)
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === "preview" && msg.repo && msg.color) {
      const opacity = getThemeOpacity();
      const rows = document.querySelectorAll('[' + ATTR + '="' + msg.repo + '"]');
      for (const row of rows) {
        row.style.backgroundColor = hexToRgba(msg.color, opacity);
        row.style.borderLeft = '4px solid ' + msg.color;
      }
    }
  });
})();
