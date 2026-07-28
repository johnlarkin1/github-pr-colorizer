# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub PR Colorizer is a Chrome Extension (Manifest V3) that applies colored backgrounds and left-border accents to pull request and issue rows on GitHub's list pages, grouping them visually by repository.

## Development

No build step, bundler, or package manager. Load the extension directly in Chrome:

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory

After code changes, click the reload button on the extension card in `chrome://extensions/`, then refresh the GitHub page.

## Architecture

**No build system** — all files are plain JS loaded directly by Chrome via `manifest.json`.

### Content Scripts (injected into GitHub pages)

- **`palette.js`** — Color palette (12 hues), DJB2 hash function (`hashStringToIndex`), `getAutoColor()` for deterministic repo-to-color mapping, and `hexToRgba()` utility. Loaded first as a dependency of both `content.js` and `popup.html`.
- **`content.js`** — IIFE that runs on `github.com/pulls*` and `github.com/issues*` pages (both global and repo-scoped). Finds rows, extracts `owner/repo` from row links using a 5-strategy fallback chain, and applies `backgroundColor` + `borderLeft` inline styles. Re-colorizes on Turbo Drive navigation (`turbo:load`), GitHub soft-nav (`soft-nav:end`), DOM mutations (MutationObserver), and storage changes.

### Two GitHub UIs — both must keep working

GitHub is mid-migration. As of July 2026, global `/pulls*` and `/issues*` **and** repo-scoped `/owner/repo/issues` serve the new React ListView, while repo-scoped `/owner/repo/pulls` is still the legacy server-rendered markup. `findPrRows()` tries the ListView first and falls back to the legacy selector chain.

Things that bite when touching row detection:

- **Never select on the new UI's class names.** `ListItem-module__listItem__wBJcm` and friends are CSS-module hashes that rotate on every GitHub deploy. `ul[data-listview-component="items-list"]` is the stable hook.
- **Row nesting differs between the two list types.** On `/pulls/*` the `<li>` is a direct child of the `<ul>`; on `/issues*` a `<div>` wraps it. Hence "outermost `<li>` under the list" rather than `ul > li`.
- **Href form differs too.** `/pulls/*` renders absolute hrefs, `/issues*` relative ones. Always read `a.pathname` (with a `a.hostname` same-origin check), never the raw `href` attribute.
- **New-UI rows contain exactly one anchor** (the title link). The `owner/repo#123` metadata is plain text that runs together with the title in `textContent`, so it is not a usable extraction source — `data-hovercard-url` is the fallback instead.
- **Rows use `content-visibility: auto`**, so `li.innerText` returns `""`. Use `textContent`.
- `LIST_PAGE` gates colorization to list paths, because the `*/issues*` match pattern also covers issue detail pages.

### Popup UI

- **`popup.html`** / **`popup.css`** / **`popup.js`** — Extension popup with enable/disable toggle, auto/manual color mode switcher, per-repo color pickers, and reset button. GitHub dark theme styling.
- **Live preview path** — dragging a color picker does *not* write to storage on every frame. `popup.js` sends a `{type: "preview", repo, color}` message straight to the active tab, and the content script restyles elements matching `[data-pr-colorizer="<repo>"]`. Storage is only written on the picker's `change`/`blur`. Any change to the `data-pr-colorizer` attribute must keep this selector working.

### Storage

- **`chrome.storage.sync`** — User settings: `mode` ("auto"|"manual"), `repoColors` (repo→hex map), `enabled` (boolean)
- **`chrome.storage.local`** — `detectedRepos` array written by content script, read by popup

### Key Design Decisions

- Opacity differs by theme: 0.18 for dark mode, 0.14 for light. `data-color-mode` is `auto | light | dark` — `auto` is the common case and must be resolved via `prefers-color-scheme`, not treated as light.
- Repo extraction uses a 5-strategy fallback: pull/issue link path → `data-hovercard-url` → `data-hovercard-type="repository"` → anchor text regex → 2-segment path with blocklist
- Picking a color in the popup auto-switches to manual mode
