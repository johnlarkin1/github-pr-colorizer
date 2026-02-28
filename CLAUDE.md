# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub PR Colorizer is a Chrome Extension (Manifest V3) that applies colored backgrounds and left-border accents to pull request rows on GitHub's `/pulls` pages, grouping them visually by repository.

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
- **`content.js`** — IIFE that runs on `github.com/pulls*` pages. Finds PR rows via multiple CSS selector strategies, extracts `owner/repo` from row links using a 4-strategy fallback chain, and applies `backgroundColor` + `borderLeft` inline styles. Re-colorizes on Turbo Drive navigation (`turbo:load`), GitHub soft-nav (`soft-nav:end`), DOM mutations (MutationObserver), and storage changes.

### Popup UI

- **`popup.html`** / **`popup.css`** / **`popup.js`** — Extension popup with enable/disable toggle, auto/manual color mode switcher, per-repo color pickers, and reset button. GitHub dark theme styling.

### Storage

- **`chrome.storage.sync`** — User settings: `mode` ("auto"|"manual"), `repoColors` (repo→hex map), `enabled` (boolean)
- **`chrome.storage.local`** — `detectedRepos` array written by content script, read by popup

### Key Design Decisions

- Opacity differs by theme: 0.18 for dark mode, 0.14 for light (detected via `data-color-mode` attribute)
- Repo extraction uses a 4-strategy fallback: PR link pattern → hovercard attribute → anchor text regex → 2-segment path with blocklist
- Picking a color in the popup auto-switches to manual mode
