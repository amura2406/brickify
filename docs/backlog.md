# Project Backlog: LEGO Mosaic Maker


> **For AI agents — read before editing this file.**
>
> This document is the single source of truth for planned and completed work on this project.
> Follow these conventions exactly when updating it:
>
> **Adding a new task**
> - Add it under the appropriate `### Section` inside `## 📋 Active Tasks`.
> - Use `- [ ]` and include a `**Description**` and `**Context**` (and `**Impact**` where relevant).
> - Never add a task that already exists in the `✅ Completed Tasks` table.
>
> **Completing a task**
> 1. **Remove** the entire bullet (and all its sub-bullets) from `## 📋 Active Tasks`.
> 2. **Append a new row** to the `✅ Completed Tasks` table with:
>    - `Task` — the same bold title used in the active list.
>    - `Date` — today's date in `YYYY-MM-DD` format.
>    - `Summary` — one or two sentences describing *how* it was done: which files were changed, what the key technical decision was, and what the observable effect is. Be specific — "Fixed the bug" is not acceptable; "Added `preserveZoom` parameter to `renderMosaic()` so history-snap-back passes `true`" is.
> 3. If a section becomes empty after removing its items, **delete the empty section heading** too.
> 4. Never leave a `[x]` checked item in `## 📋 Active Tasks` — checked means it must be moved down immediately.


## 📋 Active Tasks

### UI / UX Improvements
- [ ] **Center Mosaic Canvas Vertically and Horizontally**
  - **Description**: The mosaic canvas is centered horizontally but not vertically within the canvas wrapper. Fix the layout so the mosaic is centered on both axes, and ensure centering is preserved when zooming in/out via the slider.
  - **Context**: The parent flex container lacks proper height constraints for vertical centering to work. `applyZoom()` also needs adjustment to maintain centering during zoom changes.
- [ ] **Remove Obsolete Mosaic Config Step**
  - **Description**: Delete the "Mosaic Config" sidebar step (`step-options`) that appears between cropping and mosaic generation. All config controls already exist in the Quick Config panel on the build-plan page. After cropping, the flow should go directly to generating the mosaic with default config.
  - **Impact**: Simpler user flow (crop → auto-generate → view), one fewer navigation step.
  - **Context**: The step-options sidebar (Color Mode, Dithering, Image Adjustments, Gradient) is 100% duplicated in the Quick Config panel on the build-plan tab.

### Architecture Improvements
- [ ] **Eliminate Redundant Base64 Mosaic Payloads**
  - **Description**: Stop sending `mosaic_preview_url` and `mosaic_history[].url` (large base64 PNG snapshots) in the save payload. The frontend already has `renderMosaic()` / `renderOffscreenMosaic()` which can reconstruct the mosaic purely from `mosaic_data` (2D grid + color palette). The save payload should only contain `mosaic_data` and config — not rendered images.
  - **Impact**: Reduces save payload from ~5MB to ~50KB. Eliminates Firestore document size limit risk. History entries become lightweight (config + grid only, no PNG snapshots).
  - **Context**: Root cause of the recently fixed Save Project Error — base64 images bloated Firestore documents past the 1MiB limit.
- [ ] **Server-Side Gallery Thumbnails**
  - **Description**: Generate a small (~100px wide) mosaic thumbnail server-side at save time using Pillow, derived from `mosaic_data`. Store this tiny image in GCS and return the URL for the project gallery list.
  - **Impact**: Gallery loads fast with static `<img>` tags (no client-side canvas rendering per card). Thumbnail is ~5KB vs. current full-resolution PNG screenshots.
  - **Context**: Complements the base64 elimination above — the gallery still needs a visual preview, but it should be a purpose-built tiny thumbnail, not a multi-MB canvas export.

### Alpine.js Modernization
- [ ] **Complete State Centralization**
  - **Description**: Move the remaining `state` properties from `app.js` into an `Alpine.store`. Key remaining candidates: `imageUrl`, `croppedImageUrl`, `mosaicUrl`, `mosaicData`, `zoom`, `isCompareArena`, `mosaicHistory`, config mirrors (`colorMode`, sliders, etc.), and the loaded project ID/name.
  - **Context**: Enables two-way binding on inputs (sliders, color pickers) without manual event dispatching. The CustomEvent bridges (sets, cart, recent uploads, compare columns, projects) have already been eliminated — remaining state is the mosaic canvas and config layer.
- [ ] **UI Componentization**
  - **Description**: Extract Alpine.js `<template>` blocks from `index.html` into a dedicated `frontend/components/` directory.
  - **Context**: Reduces the size of `index.html` and improves maintainability of complex UI structures.
- [ ] **Quick Config Migration**
  - **Description**: Migrate the "Quick Config" panel (sliders and color mode toggles) fully to Alpine.js.
  - **Context**: Eliminates the last direct DOM manipulations for UI state feedback.

### Infrastructure & Engineering
- [ ] **Frontend Build Step Integration**
  - **Description**: Introduce a build tool (e.g., Vite/Webpack) to manage component lifecycle and asset bundling.
  - **Context**: Prerequisite for scalable componentization and modern JS feature usage.

---

## ✅ Completed Tasks

| Task | Date | Summary |
| :--- | :--- | :--- |
| **Save Project Error (500)** | 2026-04-14 | Fixed crash caused by base64-encoded images (`image_url`, `cropped_image_url`, `mosaic_history[].url`) being written directly into Firestore, exceeding the 1MiB document limit. Backend now intercepts all base64 fields and uploads them to GCS before persistence. |
| **Compare Arena Button & Reference Bug** | 2026-04-14 | Fixed a critical bug where promoting a column to primary triggered a logic flag (`isUserSliding`) that permanently overlaid the reference image in Single Mode. Reset the flag and ensured the reference layer is hidden after promotion. |
| **Initial Alpine.js Migration** | 2026-04-14 | Successfully migrated Compare Arena, Sets Grid, Cart, and Projects Gallery to Alpine.js. This was done to eliminate brittle imperative DOM manipulation and mitigate XSS risks associated with `innerHTML`. |
| **Zoom Level Not Retained** | 2026-04-16 | Extended `preserveZoom` coverage: (1) `generateMosaic()` now captures `isRegeneration = !!state.mosaicData` before the API call and passes it to `renderMosaic(isRegeneration)`, so re-generations (LEGO set changes, config tweaks) keep the user's zoom while the first generation still resets to 100%. (2) `switchResultMode('single')` no longer resets `state.zoom = 1.0` — it recalculates `baseScale` for the single-mode container width but preserves the user's zoom level. History snap-back and compare-column promotion already passed `true`. |
| **Zoom Slider UI Cutoff** | 2026-04-16 | Redesigned the zoom popover into a narrow 40px-wide vertical layout: rotated the `<input type=range>` 90° and gave it `position:absolute` inside a fixed-height wrapper so it never expands the flex parent. Removed stale `#zoom-popover { min-width:220px }` CSS that was overriding layout, added dark-theme custom track/thumb styling, updated JS toggle to `style.display='flex'` (not `hidden` class), and finally changed popover anchor from `bottom-full mb-2` to `top-full mt-2` so it opens downward into the canvas instead of upward into the navigation bar. |
| **Eliminate CustomEvent Bridges** | 2026-04-15 | Removed all 5 `window.dispatchEvent(new CustomEvent(...))` bridges that existed between `app.js` and Alpine templates. Added `setsLoading`, `recentImages`, `recentLoading`, `recentError`, `projects`, `projectsError`, and `projectsVisible` directly to `Alpine.store('app')`. Templates for sets-grid, cart footer, recent-uploads-grid, compare-mode-view, and projects-grid now read from `$store.app.*` directly, making state flow entirely reactive and unidirectional. |

