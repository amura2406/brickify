# Project Backlog: LEGO Mosaic Maker

This document tracks future improvements, technical debt remediation, and architectural enhancements. 

## 📋 Active Tasks

### Bug Fixes
- [ ] **Zoom Level Not Retained**
  - **Description**: The zoom level on the single mosaic view is not retained when a user changes configuration or lego sets; it always resets to 100%. State should be preserved.
- [ ] **Zoom Slider UI Cutoff**
  - **Description**: The zoom slider on single mosaic view is cut off when revealed because it is too close to the rightmost screen border.

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
  - **Description**: Move the remaining `state` properties from `app.js` into an `Alpine.store`.
  - **Context**: Enables two-way binding on inputs (sliders, color pickers) without manual event dispatching.
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

