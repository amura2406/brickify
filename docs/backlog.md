# Project Backlog: LEGO Mosaic Maker

This document tracks future improvements, technical debt remediation, and architectural enhancements. 

## 📋 Active Tasks

### Bug Fixes
- [ ] **Compare Arena "Make Active" Button Broken**
  - **Description**: In the compare arena, the button "Make this active single mode result" doesn't work. Nothing happens.
- [ ] **Single Mosaic Reference Image Bug**
  - **Description**: Related to the above, when user clicks the problematic button then moves to single mosaic manually, the reference image is shown instead of the mosaic image. It fixes itself when the user clicks "toggle reference comparison".
- [ ] **Zoom Level Not Retained**
  - **Description**: The zoom level on the single mosaic view is not retained when a user changes configuration or lego sets; it always resets to 100%. State should be preserved.
- [ ] **Zoom Slider UI Cutoff**
  - **Description**: The zoom slider on single mosaic view is cut off when revealed because it is too close to the rightmost screen border.
- [ ] **Save Project Error**
  - **Description**: User can no longer save a mosaic project. Clicking save shows an error prompt: "Failed to save project: Unexpected token 'I', "Internal S"... is not valid JSON".

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
| **Initial Alpine.js Migration** | 2026-04-14 | Successfully migrated Compare Arena, Sets Grid, Cart, and Projects Gallery to Alpine.js. This was done to eliminate brittle imperative DOM manipulation and mitigate XSS risks associated with `innerHTML`. |
