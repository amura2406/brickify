import { $ } from '../utils.js';
import { getState } from '../store.js';
import { API, authFetch } from '../api.js';
const state = new Proxy({}, {
    get(target, prop) { return getState()[prop]; },
    set(target, prop, value) { getState()[prop] = value; return true; }
});

export const mosaicState = {
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    initialPanX: 0,
    initialPanY: 0,
    panX: 0,
    panY: 0,
    pinchDistance: null,
    initialZoom: 1
};

let btn2d, btn3d, btnComparisonToggle, comparisonSlider, referenceLayer, mosaicWrapper;
let btnModeSingle, btnModeCompare, btnAddCompareColumn, singleModeView, compareModeView;
let quickDitherToggle, quickColorModeSelect;

// ── DOM refs needed by renderMosaic / renderLegend (assigned in setupResult) ──
let mosaicCanvas, mosaicTitle, mosaicSubtitle, legendItems, totalPieces, legendColorCount;

// The "default scale factor" — zoom=1.0 displays the canvas at 35% of its full resolution.
// This makes 100% in the UI = a comfortable default view.
const DEFAULT_SCALE_FACTOR = 0.35;

// ═════════════════════════════════════════════════
//  RENDER: Mosaic Canvas + Zoom + Legend
// ═════════════════════════════════════════════════

/**
 * Draw the mosaic grid onto the 2D canvas and recalculate scale/zoom.
 * @param {boolean} preserveZoom - If true, keep the user's current zoom level.
 */
function renderMosaic(preserveZoom = false) {
    if (!state.mosaicData) return;
    if (!mosaicCanvas) mosaicCanvas = $('#mosaic-canvas');
    if (!mosaicWrapper) mosaicWrapper = $('#mosaic-canvas-wrapper');
    if (!mosaicTitle) mosaicTitle = $('#mosaic-title');
    if (!mosaicSubtitle) mosaicSubtitle = $('#mosaic-subtitle');
    if (!mosaicCanvas || !mosaicWrapper) {
        console.warn('[renderMosaic] mosaicCanvas or mosaicWrapper not found — skipping render');
        return;
    }

    const { grid, colors, width, height } = state.mosaicData;

    const studSize = 15;
    const padding = 2;
    const cell = studSize + padding;

    mosaicCanvas.width = width * cell + padding;
    mosaicCanvas.height = height * cell + padding;

    const ctx = mosaicCanvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, mosaicCanvas.width, mosaicCanvas.height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ci = grid[y][x];
            const color = colors[ci];
            const cx = x * cell + padding;
            const cy = y * cell + padding;
            const centerX = cx + studSize / 2;
            const centerY = cy + studSize / 2;
            const radius = (studSize - 2) / 2;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = color.hex;
            ctx.fill();

            const hlX = centerX - radius * 0.25;
            const hlY = centerY - radius * 0.25;
            const grad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, radius * 0.7);
            grad.addColorStop(0, 'rgba(255,255,255,0.3)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    }

    const info = window.getMergedSetInfo ? window.getMergedSetInfo() : { name: 'Mosaic' };
    if (mosaicTitle) mosaicTitle.textContent = (info.name || 'Mosaic').toUpperCase();
    if (mosaicSubtitle) mosaicSubtitle.textContent = `${width}×${height} • ${(width * height).toLocaleString()} studs`;

    const wrapperWidth = mosaicWrapper.clientWidth - 32;
    state.baseScale = Math.min(1, Math.max(0.01, wrapperWidth / mosaicCanvas.width));

    // Default zoom: 1.0 = "100%" which visually corresponds to 35% of full-resolution.
    // Only reset if this is a fresh render (new generation or project load).
    // When preserveZoom=true (e.g. history peek snap-back), keep whatever the user set.
    if (!preserveZoom) state.zoom = 1.0;

    // maxZoom is a fixed 3.0 (300%) — the slider's own max="500" in HTML already
    // enforces this upper bound.
    state.maxZoom = 3.0;

    mosaicState.panX = 0;
    mosaicState.panY = 0;

    applyZoom();
}

/**
 * Apply the current zoom/pan state to the mosaic canvas CSS dimensions.
 */
function applyZoom() {
    if (!mosaicCanvas) mosaicCanvas = $('#mosaic-canvas');
    if (!mosaicCanvas) return;

    const scale = state.baseScale * DEFAULT_SCALE_FACTOR * state.zoom;
    const cw = mosaicCanvas.width * scale;
    const ch = mosaicCanvas.height * scale;

    // Scale the canvas via CSS properties directly
    mosaicCanvas.style.width = cw + 'px';
    mosaicCanvas.style.height = ch + 'px';

    // Exact match for the comparison slider container so it shrinks naturally
    const wrapper = $('#comparison-wrapper');
    if (wrapper) {
        wrapper.style.width = cw + 'px';
        wrapper.style.height = ch + 'px';
        wrapper.style.margin = 'auto';
        wrapper.style.transform = `translate(${mosaicState.panX}px, ${mosaicState.panY}px)`;
    }

    // Sync zoom slider + popover label if they exist
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomPopoverLabel = document.getElementById('zoom-popover-label');
    if (zoomSlider) zoomSlider.value = Math.round(state.zoom * 100);
    if (zoomPopoverLabel) zoomPopoverLabel.textContent = Math.round(state.zoom * 100) + '%';
}

/**
 * Populate the colour legend panel with the current mosaic's colour data.
 */
function renderLegend() {
    if (!state.mosaicData) return;
    if (!legendItems) legendItems = $('#legend-items');
    if (!totalPieces) totalPieces = $('#total-pieces');
    if (!legendColorCount) legendColorCount = $('#legend-color-count');
    if (!legendItems) return;

    const { colors } = state.mosaicData;
    legendItems.innerHTML = '';

    let totalUsed = 0;
    const isFreeMode = colors.some(c => c.count >= 9999);

    colors.forEach((c) => {
        if (c.used === 0 && c.count === 0) return;
        totalUsed += c.used;

        const countLabel = isFreeMode ? `${c.used}` : `${c.used}/${c.count}`;
        const pct = isFreeMode ? 100 : Math.round((c.used / c.count) * 100);

        const item = document.createElement('div');
        item.className = 'legend-item-compact';
        item.title = `${c.name}: ${isFreeMode ? c.used + ' used' : c.used + ' / ' + c.count + ' used'}`;
        item.innerHTML = `
            <div class="legend-swatch-sm" style="background:${c.hex}"></div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                    <span class="legend-name-sm truncate">${c.name}</span>
                    <span class="legend-count-sm">${countLabel}</span>
                </div>
                <div class="legend-bar-bg">
                    <div class="legend-bar-fill" style="width:${pct}%;background:${c.hex}"></div>
                </div>
            </div>
        `;
        legendItems.appendChild(item);
    });

    const totalLabel = isFreeMode ? `${totalUsed.toLocaleString()} pcs` : `${totalUsed.toLocaleString()} pcs used`;
    if (totalPieces) totalPieces.textContent = totalLabel;
    if (legendColorCount) legendColorCount.textContent = `${colors.filter(c => c.used > 0).length}`;
}

// Expose on window for cross-module access (generate.js, project.js)
window.renderMosaic = renderMosaic;
window.renderLegend = renderLegend;
window.applyZoom = applyZoom;

// ═════════════════════════════════════════════════
//  BUILD PLAN: CONTROLS (2D/3D, Comparison, Zoom)
// ═════════════════════════════════════════════════
export function setupResult() {
    if (window.__resultEventsBound) {
        syncQuickConfigUI();
        return;
    }
    window.__resultEventsBound = true;

    btn2d = $('#btn-2d');
    btn3d = $('#btn-3d');
    btnComparisonToggle = $('#btn-comparison-toggle');
    comparisonSlider = $('#comparison-slider');
    referenceLayer = $('#reference-layer');
    mosaicWrapper = $('#mosaic-canvas-wrapper');
    btnModeSingle = $('#btn-mode-single');
    btnModeCompare = $('#btn-mode-compare');
    btnAddCompareColumn = $('#btn-add-compare-column');
    singleModeView = $('#single-mode-view');
    compareModeView = $('#compare-mode-view');
    quickDitherToggle = $('#quick-dither-toggle');
    quickColorModeSelect = $('#quick-color-mode-select');

    // Zoom slider popover
    const zoomToggleBtn = document.getElementById('btn-zoom-toggle');
    const zoomPopover = document.getElementById('zoom-popover');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomResetBtn = document.getElementById('btn-zoom-reset');

    if (zoomToggleBtn && zoomPopover) {
        zoomToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = zoomPopover.style.display !== 'none';
            zoomPopover.style.display = isOpen ? 'none' : 'flex';
        });
        // Close popover on outside click
        document.addEventListener('click', (e) => {
            if (!zoomPopover.contains(e.target) && e.target !== zoomToggleBtn && !zoomToggleBtn.contains(e.target)) {
                zoomPopover.style.display = 'none';
            }
        });
    }
    if (zoomSlider) {
        zoomSlider.addEventListener('mousedown', (e) => e.stopPropagation());
        zoomSlider.addEventListener('touchstart', (e) => e.stopPropagation());
        zoomSlider.addEventListener('input', () => {
            state.zoom = parseInt(zoomSlider.value) / 100;
            applyZoom();
        });
    }
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', () => {
            state.zoom = 1.0;
            mosaicState.panX = 0;
            mosaicState.panY = 0;
            applyZoom();
        });
    }

    // Mosaic Canvas interactions (pan / pinch zoom — wheel zoom removed)
    const mw = $('#mosaic-canvas-wrapper');

    if (mw) {
        mw.addEventListener('mousedown', (e) => {
            if (e.target.id === 'comparison-slider') return;
            mosaicState.dragging = true;
            mosaicState.dragStartX = e.clientX;
            mosaicState.dragStartY = e.clientY;
            mosaicState.initialPanX = mosaicState.panX;
            mosaicState.initialPanY = mosaicState.panY;
        });

        mw.addEventListener('touchstart', (e) => {
            if (e.target.id === 'comparison-slider') return;
            if (e.touches.length === 1) {
                mosaicState.dragging = true;
                mosaicState.dragStartX = e.touches[0].clientX;
                mosaicState.dragStartY = e.touches[0].clientY;
                mosaicState.initialPanX = mosaicState.panX;
                mosaicState.initialPanY = mosaicState.panY;
            } else if (e.touches.length === 2) {
                mosaicState.dragging = false; 
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                mosaicState.pinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                mosaicState.initialZoom = state.zoom;
                e.preventDefault();
            }
        }, { passive: false });
    }

    window.addEventListener('mousemove', (e) => {
        if (!mosaicState.dragging) return;
        mosaicState.panX = mosaicState.initialPanX + (e.clientX - mosaicState.dragStartX);
        mosaicState.panY = mosaicState.initialPanY + (e.clientY - mosaicState.dragStartY);
        applyZoom();
    });

    window.addEventListener('touchmove', (e) => {
        if (e.target.id === 'comparison-slider') return; // let native range work
        if (mosaicState.dragging && e.touches.length === 1) {
            mosaicState.panX = mosaicState.initialPanX + (e.touches[0].clientX - mosaicState.dragStartX);
            mosaicState.panY = mosaicState.initialPanY + (e.touches[0].clientY - mosaicState.dragStartY);
            applyZoom();
            e.preventDefault();
        } else if (e.touches.length === 2 && mosaicState.pinchDistance !== null) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const delta = dist - mosaicState.pinchDistance;
            state.zoom = Math.max(0.3, Math.min(5, mosaicState.initialZoom + delta * 0.01));
            applyZoom();
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('mouseup', () => mosaicState.dragging = false);
    window.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) mosaicState.pinchDistance = null;
        if (e.touches.length === 0) mosaicState.dragging = false;
    });

    // ─── Quick Config: multi-set chip UI ───────────────────────────────────────
    const quickSetChips    = document.getElementById('quick-set-chips');
    const quickAddSetBtn   = document.getElementById('quick-add-set-btn');
    const quickAddPopover  = document.getElementById('quick-add-set-popover');
    const quickAddSearch   = document.getElementById('quick-add-set-search');
    const quickAddSetList  = document.getElementById('quick-add-set-list');

    let _quickRegenTimer = null;
    function scheduleRegen() {
        clearTimeout(_quickRegenTimer);
        _quickRegenTimer = setTimeout(() => { if (state.croppedImageUrl) generateMosaic(); }, 800);
    }

    function renderQuickChips() {
        quickSetChips.innerHTML = '';
        if (state.setSelections.length === 0) {
            // Free mode chip
            quickSetChips.innerHTML = `
                <div class="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1.5 text-xs">
                    <span class="text-secondary font-bold flex-1">Free Mode (All Colors)</span>
                    <span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" style="font-size:15px" data-action="remove-free">close</span>
                </div>`;
            quickSetChips.querySelector('[data-action="remove-free"]').addEventListener('click', () => {
                // Nothing to remove in free mode — prompt user to add a set
                quickAddPopover.classList.remove('hidden');
                quickAddPopover.style.display = 'flex';
            });
            return;
        }
        state.setSelections.forEach((sel, idx) => {
            const chip = document.createElement('div');
            chip.className = 'flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-lg px-2 py-1 text-xs group';
            chip.innerHTML = `
                <span class="flex-1 text-on-surface font-bold truncate" title="${sel.set.name}">${sel.set.name}</span>
                <div class="flex items-center gap-0.5 ml-1 shrink-0">
                    <button class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" data-action="dec" data-idx="${idx}">
                        <span class="material-symbols-outlined" style="font-size:12px">remove</span>
                    </button>
                    <span class="text-primary font-bold w-5 text-center" data-qty="${idx}">×${sel.qty}</span>
                    <button class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" data-action="inc" data-idx="${idx}">
                        <span class="material-symbols-outlined" style="font-size:12px">add</span>
                    </button>
                    <button class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" data-action="replace" data-idx="${idx}" title="Replace set">
                        <span class="material-symbols-outlined" style="font-size:12px">swap_horiz</span>
                    </button>
                    <button class="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors ml-0.5" data-action="remove" data-idx="${idx}">
                        <span class="material-symbols-outlined" style="font-size:12px">close</span>
                    </button>
                </div>`;
            chip.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const i = parseInt(btn.dataset.idx);
                    if (btn.dataset.action === 'inc') {
                        state.setSelections[i].qty = Math.min(state.setSelections[i].qty + 1, 9);
                    } else if (btn.dataset.action === 'dec') {
                        state.setSelections[i].qty = Math.max(state.setSelections[i].qty - 1, 1);
                    } else if (btn.dataset.action === 'remove') {
                        state.setSelections.splice(i, 1);
                    } else if (btn.dataset.action === 'replace') {
                        // Open the add popover in replace mode
                        window._replaceSetIdx = i;
                        quickAddPopover.classList.remove('hidden');
                        quickAddPopover.style.display = 'flex';
                        quickAddSearch.value = '';
                        buildQuickAddList('');
                        quickAddSearch.focus();
                        return; // Don't regenerate yet
                    }
                    renderSelectedSets();
                    renderQuickChips();
                    scheduleRegen();
                });
            });
            quickSetChips.appendChild(chip);
        });
    }
    window.renderQuickChips = renderQuickChips;

    function buildQuickAddList(filterText = '') {
        const q = filterText.toLowerCase();
        const allSets = state.allSets;
        const isReplaceMode = typeof window._replaceSetIdx === 'number';
        const compCol = window._compareColId ? state.compareColumns.find(c => c.id === window._compareColId) : null;
        const targetSelections = compCol ? compCol.setSelections : state.setSelections;

        quickAddSetList.innerHTML = allSets
            .filter(s => !filterText || s.name.toLowerCase().includes(q) || s.id.includes(q))
            .map(s => {
                const inCart = targetSelections.some(sel => sel.set.id === s.id);
                return `
                <button class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-surface-container transition-colors w-full ${inCart ? 'text-primary' : 'text-on-surface'}"
                    data-set-id="${s.id}">
                    <span class="material-symbols-outlined" style="font-size:14px">${isReplaceMode ? 'swap_horiz' : (inCart ? 'check_circle' : 'add_circle')}</span>
                    <span class="flex-1">${s.name}</span>
                    <span class="text-on-surface-variant">#${s.id}</span>
                </button>`;
            }).join('');
        quickAddSetList.querySelectorAll('[data-set-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const setId = btn.dataset.setId;
                const setObj = state.allSets.find(s => s.id === setId);
                if (!setObj) return;

                if (isReplaceMode) {
                    // Replace mode: swap the set at the stored index
                    const idx = window._replaceSetIdx;
                    if (idx >= 0 && idx < targetSelections.length) {
                        targetSelections[idx] = { set: setObj, qty: targetSelections[idx].qty };
                    }
                    window._replaceSetIdx = undefined;
                    quickAddPopover.classList.add('hidden');
                    quickAddPopover.style.display = '';
                } else {
                    // Normal toggle mode
                    const existing = targetSelections.find(s => s.set.id === setId);
                    if (existing) {
                        if (compCol) compCol.setSelections = targetSelections.filter(s => s.set.id !== setId);
                        else state.setSelections = targetSelections.filter(s => s.set.id !== setId);
                    } else {
                        targetSelections.push({ set: setObj, qty: 1 });
                    }
                }
                
                if (compCol) {
                    if (window.renderCompareColumns) window.renderCompareColumns();
                    if (window.generateCompareColumn) window.generateCompareColumn(compCol.id);
                } else {
                    renderSelectedSets();
                    renderQuickChips();
                    scheduleRegen();
                }
                buildQuickAddList(quickAddSearch.value);
            });
        });
    }

    window.addCompareSet = function(e, colId) {
        if (e) e.stopPropagation();
        window._compareColId = colId;
        window._replaceSetIdx = undefined;
        quickAddPopover.classList.remove('hidden');
        quickAddPopover.style.display = 'flex';
        quickAddSearch.value = '';
        buildQuickAddList('');
        quickAddSearch.focus();
    };
    
    window.replaceCompareSet = function(e, colId, idx) {
        if (e) e.stopPropagation();
        window._compareColId = colId;
        window._replaceSetIdx = idx;
        quickAddPopover.classList.remove('hidden');
        quickAddPopover.style.display = 'flex';
        quickAddSearch.value = '';
        buildQuickAddList('');
        quickAddSearch.focus();
    };

    // Toggle popover
    if (quickAddSetBtn) {
        quickAddSetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = quickAddPopover.classList.contains('hidden');
            if (isHidden) {
                window._compareColId = undefined; // Clear compare targeting
                window._replaceSetIdx = undefined; // Clear replace mode
                quickAddPopover.classList.remove('hidden');
                quickAddPopover.style.display = 'flex';
                quickAddSearch.value = '';
                buildQuickAddList('');
                quickAddSearch.focus();
            } else {
                window._replaceSetIdx = undefined;
                quickAddPopover.classList.add('hidden');
                quickAddPopover.style.display = '';
            }
        });
    }
    // Close popover when clicking outside modal content
    document.addEventListener('click', (e) => {
        const modalContent = document.getElementById('quick-add-set-modal-content');
        const isClickingModal = modalContent && modalContent.contains(e.target);
        const isClickingBtn = quickAddSetBtn && (e.target === quickAddSetBtn || quickAddSetBtn.contains(e.target));
        const isHidden = quickAddPopover && quickAddPopover.classList.contains('hidden');
        
        if (!isHidden && !isClickingModal && !isClickingBtn) {
            window._replaceSetIdx = undefined;
            if (quickAddPopover) {
                quickAddPopover.classList.add('hidden');
                quickAddPopover.style.display = '';
            }
        }
    });
    // Search filter
    if (quickAddSearch) {
        quickAddSearch.addEventListener('input', () => buildQuickAddList(quickAddSearch.value));
    }
    // ───────────────────────────────────────────────────────────────────────────

    function syncQuickConfigUI() {
        renderQuickChips();
        
        // With Alpine.js binding, store changes automatically reflect in the UI.
    }
    window.syncQuickConfigUI = syncQuickConfigUI;
    syncQuickConfigUI();

    if (quickDitherToggle) {
        quickDitherToggle.addEventListener('change', () => {
                    hideReferenceLayerImmediately();
            generateMosaic();
        });
    }
    if (quickColorModeSelect) {
        quickColorModeSelect.addEventListener('change', () => {
            hideReferenceLayerImmediately();
            generateMosaic();
        });
    }
    // 2D / 3D toggle
    btn2d.addEventListener('click', () => {
        if (isComparisonActive) toggleComparison();
        $('#mosaic-canvas-wrapper').style.display = 'block';
        document.getElementById('3d-canvas-container').style.display = 'none';
        btn2d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all bg-primary text-on-primary shadow-[0_0_10px_rgba(255,45,120,0.4)]';
        btn3d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all text-on-surface-variant hover:text-on-surface';
    });
    btn3d.addEventListener('click', () => {
        if (isComparisonActive) toggleComparison();
        $('#mosaic-canvas-wrapper').style.display = 'none';
        document.getElementById('3d-canvas-container').style.display = 'block';
        document.getElementById('3d-canvas-container').classList.remove('hidden');
        
        btn3d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all bg-primary text-on-primary shadow-[0_0_10px_rgba(255,45,120,0.4)]';
        btn2d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all text-on-surface-variant hover:text-on-surface';
        
        // Wait for layout to settle before initializing/updating Three.js
        setTimeout(() => {
            if (!window.__3dInitialized) {
                init3DScene();
                window.__3dInitialized = true;
            } else {
                window.update3DMosaic();
            }
        }, 50);
    });

    // Comparison toggle
    btnComparisonToggle.addEventListener('click', toggleComparison);
    comparisonSlider.addEventListener('input', (e) => {
        referenceLayer.style.clipPath = `inset(0 ${100 - e.target.value}% 0 0)`;
    });

    // Download & navigation
    // Mode toggles
    if (btnModeSingle && btnModeCompare) {
        btnModeSingle.addEventListener('click', () => switchResultMode('single'));
        btnModeCompare.addEventListener('click', () => switchResultMode('compare'));
        btnAddCompareColumn.addEventListener('click', () => addCompareColumn(true, true));
    }

    $('#btn-download').addEventListener('click', downloadMosaic);
    $('#btn-download-instructions').addEventListener('click', downloadInstructions);
    $('#btn-start-over')?.addEventListener('click', startOver);
    $('#btn-change-set')?.addEventListener('click', changeSets);

    // Logo → home (back to sets)
    document.getElementById('btn-logo-home')?.addEventListener('click', () => {
        startOver();
    });
    // Breadcrumb → sets
    document.getElementById('btn-breadcrumb-sets')?.addEventListener('click', () => {
        showTab('sets');
    });
    $('#btn-save-project')?.addEventListener('click', openSaveProjectDialog);
}

let isComparisonActive = false;
window.isComparisonActive = false;
function toggleComparison() {
    isComparisonActive = !isComparisonActive;
    window.isComparisonActive = isComparisonActive;
    if (isComparisonActive) {
        mosaicWrapper.classList.remove('mosaic-3d-perspective');
        btn2d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all bg-primary text-on-primary shadow-[0_0_10px_rgba(255,45,120,0.4)]';
        btn3d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all text-on-surface-variant hover:text-on-surface';
        referenceLayer.classList.remove('hidden');
        comparisonSlider.classList.remove('hidden');
        btnComparisonToggle.classList.add('!bg-primary/20', '!text-primary', '!border-primary/60');
        
        // FIX: Ensure comparison slider is at 50% and clip-path matches
        comparisonSlider.value = 50;
        referenceLayer.style.clipPath = 'inset(0 50% 0 0)';
        
        const labelRef = $('#label-reference');
        const labelMos = $('#label-mosaic');
        if (labelRef) {
            labelRef.classList.remove('opacity-0');
            labelRef.classList.add('opacity-100');
        }
        if (labelMos) {
            labelMos.classList.remove('opacity-0');
            labelMos.classList.add('opacity-100');
        }
        
        // FIX: Force re-apply zoom so wrapper dimensions match the canvas
        applyZoom();
    } else {
        referenceLayer.classList.add('hidden');
        comparisonSlider.classList.add('hidden');
        btnComparisonToggle.classList.remove('!bg-primary/20', '!text-primary', '!border-primary/60');
        const labelRef = $('#label-reference');
        const labelMos = $('#label-mosaic');
        if (labelRef) {
            labelRef.classList.add('opacity-0');
            labelRef.classList.remove('opacity-100');
        }
        if (labelMos) {
            labelMos.classList.add('opacity-0');
            labelMos.classList.remove('opacity-100');
        }
    }
}

function startOver() {
    Object.assign(state, { setSelections: [], imageUrl: null, imageWidth: 0, imageHeight: 0, isSquare: false, croppedImageUrl: null, mosaicUrl: null, mosaicData: null, zoom: 1, baseScale: 1, compareColumns: [], isCompareArena: false, targetW: 0, targetH: 0 });
    renderSelectedSets();
    if (window.renderQuickChips) window.renderQuickChips();
    if (typeof renderCompareColumns === 'function') renderCompareColumns();
    showTab('sets');
}

function changeSets() {
    showTab('sets');
}

function downloadMosaic() {
    const link = document.createElement('a');
    link.download = `brickify-mosaic.png`;
    link.href = mosaicCanvas.toDataURL('image/png');
    link.click();
}

async function downloadInstructions() {
    if (!state.mosaicData) return;
    
    const { grid, colors, width, height } = state.mosaicData;
    const btn = $('#btn-download-instructions');
    const oldHtml = btn.innerHTML;
    
    try {
        setBtnLoading(btn, true, 'Generating PDF...');
        
        const res = await authFetch(`${API}/api/generate-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grid, colors, width, height })
        });
        
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || 'PDF generation failed');
        }
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `brickify-instructions-${width}x${height}.pdf`;
        link.href = url;
        link.click();
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
    } catch (e) {
        console.error('Failed to generate PDF:', e);
        alert('Failed to generate PDF: ' + e.message);
    } finally {
        setBtnLoading(btn, false);
        btn.innerHTML = oldHtml;
    }
}

function isLightColor(rgb) {
    if (!rgb) return false;
    const [r, g, b] = rgb;
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
}

// ═════════════════════════════════════════════════
//  UTILITIES
// ═════════════════════════════════════════════════
function setBtnLoading(btn, loading, loadingText = 'Loading…') {
    const textEl = btn.querySelector('.btn-text');
    const loaderEl = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    if (loading) {
        if (textEl) textEl.classList.add('hidden');
        if (loaderEl) { loaderEl.classList.remove('hidden'); loaderEl.style.display = 'flex'; }
        else {
            if (!btn.hasAttribute('data-original-html')) {
                btn.setAttribute('data-original-html', btn.innerHTML);
            }
            btn.textContent = loadingText;
        }
    } else {
        if (textEl) textEl.classList.remove('hidden');
        if (loaderEl) { loaderEl.classList.add('hidden'); loaderEl.style.display = ''; }
        else if (btn.hasAttribute('data-original-html')) {
            btn.innerHTML = btn.getAttribute('data-original-html');
            btn.removeAttribute('data-original-html');
        }
    }
}

// ═════════════════════════════════════════════════
//  3D WEGL IMPLEMENTATION (THREE.JS)
// ═════════════════════════════════════════════════
let scene3d, camera3d, renderer3d, controls3d, mosaicGroup;

function init3DScene() {
    const container = document.getElementById('3d-canvas-container');
    if (!container) return;

    // Measure container — use offsetWidth for reliable layout-computed size
    let w = container.offsetWidth || container.parentElement?.offsetWidth || 800;
    let h = container.offsetHeight || w; // aspect-square → h equals w

    // Scene setup
    scene3d = new THREE.Scene();
    scene3d.background = new THREE.Color('#101216');

    // Camera
    camera3d = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    camera3d.position.set(0, -60, 50);
    camera3d.lookAt(0, 0, 0);

    // Renderer — explicit pixel-perfect size
    renderer3d = new THREE.WebGLRenderer({ antialias: true });
    renderer3d.setSize(w, h);
    renderer3d.setPixelRatio(window.devicePixelRatio);
    renderer3d.shadowMap.enabled = true;
    renderer3d.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer3d.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene3d.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, -50, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.left = -80;
    dirLight.shadow.camera.right = 80;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    scene3d.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xccddff, 0.4);
    fillLight.position.set(-50, 50, 50);
    scene3d.add(fillLight);

    // Controls
    controls3d = new THREE.OrbitControls(camera3d, renderer3d.domElement);
    controls3d.enableDamping = true;
    controls3d.dampingFactor = 0.05;
    controls3d.target.set(0, 0, 0);
    controls3d.update();

    mosaicGroup = new THREE.Group();
    scene3d.add(mosaicGroup);

    // Resize handler
    window.addEventListener('resize', () => {
        const c = document.getElementById('3d-canvas-container');
        if (!c || c.style.display === 'none') return;
        const rw = c.offsetWidth || 800;
        const rh = c.offsetHeight || rw;
        camera3d.aspect = rw / rh;
        camera3d.updateProjectionMatrix();
        renderer3d.setSize(rw, rh);
    });

    // Animation Loop
    const animate = () => {
        requestAnimationFrame(animate);
        if (controls3d) controls3d.update();
        if (renderer3d && scene3d && camera3d) renderer3d.render(scene3d, camera3d);
    };
    animate();

    window.update3DMosaic();
}

window.update3DMosaic = function() {
    if (!scene3d || !state.mosaicData) return;
    
    const { grid, colors, width, height } = state.mosaicData;
    
    // Clear previous
    while(mosaicGroup.children.length > 0){ 
        const obj = mosaicGroup.children[0];
        mosaicGroup.remove(obj); 
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    }
    
    // Lego sets often use flat tiles (Elvis/Marilyn) vs round plates (Batman/StarWars)
    const TILE_SETS = ['31204', '31197']; // Elvis, Warhol
    let useTiles = false;
    if (state.setSelections && state.setSelections.length > 0) {
        useTiles = state.setSelections.some(s => s.set && TILE_SETS.includes(s.set.id));
    }
    
    // Standard Lego dimensions
    const studSpacing = 1.0; 
    const studRadius = 0.35;
    const basePlateThickness = 0.5;
    const tileThickness = 0.32;
    const studHeight = 0.18;
    
    // Center alignment
    const wOffset = (width * studSpacing) / 2 - (studSpacing / 2);
    const hOffset = (height * studSpacing) / 2 - (studSpacing / 2);
    
    // Create base plate (black)
    const baseGeom = new THREE.BoxGeometry(width * studSpacing, height * studSpacing, basePlateThickness);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x05131D, roughness: 0.8, metalness: 0.1 });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.z = -basePlateThickness / 2;
    baseMesh.receiveShadow = true;
    mosaicGroup.add(baseMesh);
    
    // Create frame (black border around the plate)
    const frameThickness = 0.8;
    const frameDepth = 1.5;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x05131D, roughness: 0.6 });
    
    // Top/Bottom frame parts
    const frameHGeom = new THREE.BoxGeometry(width * studSpacing + frameThickness * 2, frameThickness, frameDepth);
    const frameMeshTop = new THREE.Mesh(frameHGeom, frameMat);
    frameMeshTop.position.set(0, height * studSpacing / 2 + frameThickness / 2, frameDepth / 2 - basePlateThickness);
    frameMeshTop.castShadow = true;
    frameMeshTop.receiveShadow = true;
    
    const frameMeshBot = new THREE.Mesh(frameHGeom, frameMat);
    frameMeshBot.position.set(0, -height * studSpacing / 2 - frameThickness / 2, frameDepth / 2 - basePlateThickness);
    frameMeshBot.castShadow = true;
    frameMeshBot.receiveShadow = true;
    
    // Left/Right frame parts
    const frameVGeom = new THREE.BoxGeometry(frameThickness, height * studSpacing, frameDepth);
    const frameMeshLeft = new THREE.Mesh(frameVGeom, frameMat);
    frameMeshLeft.position.set(-width * studSpacing / 2 - frameThickness / 2, 0, frameDepth / 2 - basePlateThickness);
    frameMeshLeft.castShadow = true;
    frameMeshLeft.receiveShadow = true;
    
    const frameMeshRight = new THREE.Mesh(frameVGeom, frameMat);
    frameMeshRight.position.set(width * studSpacing / 2 + frameThickness / 2, 0, frameDepth / 2 - basePlateThickness);
    frameMeshRight.castShadow = true;
    frameMeshRight.receiveShadow = true;
    
    mosaicGroup.add(frameMeshTop, frameMeshBot, frameMeshLeft, frameMeshRight);

    const geometries = {};
    const materials = {};
    const instancedBases = {};
    const instancedStuds = {};
    
    // Choose base geometry (round plate for normal, flat tile for useTiles)
    const baseCylGeom = useTiles 
        ? new THREE.BoxGeometry(0.96, 0.96, tileThickness) 
        : new THREE.CylinderGeometry(0.48, 0.48, tileThickness, 16);
        
    // Always translate to rest on Z=0
    if (!useTiles) {
        baseCylGeom.rotateX(Math.PI / 2);
    }
    
    const studGeom = new THREE.CylinderGeometry(studRadius, studRadius, studHeight, 12);
    studGeom.rotateX(Math.PI / 2);
    studGeom.translate(0, 0, tileThickness / 2 + studHeight / 2);
    
    const colorCounts = new Array(colors.length).fill(0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            colorCounts[grid[y][x]]++;
        }
    }
    
    for (let i = 0; i < colors.length; i++) {
        if (colorCounts[i] === 0) continue;
        
        const mat = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color(colors[i].hex), 
            roughness: 0.3, 
            metalness: 0.1 
        });
        
        const imeshBase = new THREE.InstancedMesh(baseCylGeom, mat, colorCounts[i]);
        imeshBase.castShadow = true;
        imeshBase.receiveShadow = true;
        instancedBases[i] = imeshBase;
        mosaicGroup.add(imeshBase);
        
        if (!useTiles) {
            const imeshStud = new THREE.InstancedMesh(studGeom, mat, colorCounts[i]);
            imeshStud.castShadow = true;
            imeshStud.receiveShadow = true;
            instancedStuds[i] = imeshStud;
            mosaicGroup.add(imeshStud);
        }
    }
    
    const dummy = new THREE.Object3D();
    const counters = new Array(colors.length).fill(0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ci = grid[y][x];
            dummy.position.set(
                x * studSpacing - wOffset,
                -(y * studSpacing - hOffset),
                tileThickness / 2
            );
            dummy.updateMatrix();
            instancedBases[ci].setMatrixAt(counters[ci], dummy.matrix);
            if (!useTiles) {
                instancedStuds[ci].setMatrixAt(counters[ci], dummy.matrix);
            }
            counters[ci]++;
        }
    }
    
    Object.values(instancedBases).forEach(imesh => imesh.instanceMatrix.needsUpdate = true);
    if (!useTiles) {
        Object.values(instancedStuds).forEach(imesh => imesh.instanceMatrix.needsUpdate = true);
    }
    
    // Initial camera position. Look straightforward at the mosaic.
    const maxDim = Math.max(width, height) * studSpacing;
    camera3d.position.set(0, -maxDim * 0.8, maxDim * 1.0);
    camera3d.lookAt(0, 0, 0);
    controls3d.target.set(0, 0, 0);
    controls3d.update();

    const container = document.getElementById('3d-canvas-container');
    const containerWidth = (container && container.offsetWidth) || 800;
    const containerHeight = (container && container.offsetHeight) || containerWidth;
    camera3d.aspect = containerWidth / containerHeight;
    camera3d.updateProjectionMatrix();
    renderer3d.setSize(containerWidth, containerHeight);
};

// ═════════════════════════════════════════════════
//  COMPARISON ARENA (Mode)
// ═════════════════════════════════════════════════

function switchResultMode(mode) {
    state.isCompareArena = (mode === 'compare');
    if (state.isCompareArena) {
        btnModeSingle.classList.remove('text-primary', 'border-primary');
        btnModeSingle.classList.add('text-on-surface-variant', 'border-transparent');

        btnModeCompare.classList.remove('text-on-surface-variant', 'border-transparent');
        btnModeCompare.classList.add('text-primary', 'border-primary');

        singleModeView.classList.add('hidden');
        singleModeView.classList.remove('flex');
        compareModeView.classList.remove('hidden');

        // Initialize if empty
        if (state.compareColumns.length === 0) {
            addCompareColumn(true);
            addCompareColumn(false);
        }
    } else {
        btnModeCompare.classList.remove('text-primary', 'border-primary');
        btnModeCompare.classList.add('text-on-surface-variant', 'border-transparent');

        btnModeSingle.classList.remove('text-on-surface-variant', 'border-transparent');
        btnModeSingle.classList.add('text-primary', 'border-primary');

        compareModeView.classList.add('hidden');
        singleModeView.classList.remove('hidden');
        singleModeView.classList.add('flex');

        if (state.mosaicData) {
            // Defer to next frame so the single-mode container is visible and has a
            // real clientWidth before renderMosaic reads mosaicWrapper.clientWidth.
            // renderMosaic(true) recalculates baseScale AND maxZoom for the current
            // container size while preserving state.zoom — the safe, DRY path.
            requestAnimationFrame(() => renderMosaic(true));
        }
    }
}

function addCompareColumn(autoGenerate = false, isUserInteraction = false) {
    if (state.compareColumns.length >= 5) {
        alert("Maximum 5 comparisons allowed.");
        return;
    }
    
    // Copy current global settings or last column's settings
    const lastCol = state.compareColumns.length > 0 ? state.compareColumns[state.compareColumns.length - 1] : null;

    let mutatePrimarySet = false;
    let mutateDithering = false;
    let mutateColorMode = false;

    if (isUserInteraction && lastCol) {
        const choice = prompt("Choose a variant mutation:\n1: Swap primary set out for another set\n2: Toggle dithering\n3: Toggle Pop Art vs Gradient\n(Leave blank to just copy current)");
        
        if (choice === null) return; // User cancelled
        
        if (choice === '1') mutatePrimarySet = true;
        if (choice === '2') mutateDithering = true;
        if (choice === '3') mutateColorMode = true;
    }
    
    const newCol = {
        id: Date.now().toString(),
        colorMode: lastCol ? lastCol.colorMode : (quickColorModeSelect ? quickColorModeSelect.value : 'realistic'),
        dithering: lastCol ? lastCol.dithering : quickDitherToggle.checked,
        contrast: lastCol ? lastCol.contrast : state.adj_contrast,
        preprocessing: lastCol ? lastCol.preprocessing : true,
        gradientColors: lastCol ? [...lastCol.gradientColors] : getGradientColors(),
        setSelections: (lastCol ? lastCol.setSelections : state.setSelections).map(s => ({ set: s.set, qty: s.qty })),
        mosaicUrl: null,
        mosaicData: null,
        loading: false,
        error: null
    };

    if (mutatePrimarySet) {
        if (newCol.setSelections.length > 0 && state.allSets.length > 1) {
            const currentId = newCol.setSelections[0].set.id;
            const altSet = state.allSets.find(s => s.id !== currentId) || state.allSets[0];
            newCol.setSelections[0] = { set: altSet, qty: newCol.setSelections[0].qty };
        } else if (newCol.setSelections.length === 0 && state.allSets.length > 0) {
            newCol.setSelections = [{ set: state.allSets[0], qty: 1 }];
        }
    }
    
    if (mutateDithering) {
        newCol.dithering = !newCol.dithering;
    }
    
    if (mutateColorMode) {
        newCol.colorMode = newCol.colorMode === 'pop_art' ? 'gradient' : 'pop_art';
    }
    
    state.compareColumns.push(newCol);
    renderCompareColumns();
    if (autoGenerate) {
        generateCompareColumn(newCol.id);
    }
}

function removeCompareColumn(id) {
    if (state.compareColumns.length <= 2) {
        alert("Minimum 2 columns required in comparison mode.");
        return;
    }
    state.compareColumns = state.compareColumns.filter(c => c.id !== id);
    renderCompareColumns();
}

window.updateCompareSetQty = function(colId, idx, delta) {
    const col = state.compareColumns.find(c => c.id === colId);
    if (!col) return;
    const item = col.setSelections[idx];
    if (item) {
        item.qty = Math.max(1, Math.min(9, item.qty + delta));
        renderCompareColumns();
        generateCompareColumn(colId);
    }
};

window.removeCompareSet = function(colId, idx) {
    const col = state.compareColumns.find(c => c.id === colId);
    if (!col) return;
    col.setSelections.splice(idx, 1);
    renderCompareColumns();
    generateCompareColumn(colId);
};

window.renderCompareColumns = renderCompareColumns;
function renderCompareColumns() {
    // compareColumns lives in the Alpine store ($store.app.compareColumns).
    // Alpine's reactivity picks up changes automatically when elements of the
    // array are replaced. Force a new array reference so Alpine detects the change.
    state.compareColumns = JSON.parse(JSON.stringify(state.compareColumns));
}

window.updateCompareConfig = function(id, key, value) {
    const col = state.compareColumns.find(c => c.id === id);
    if (col) {
        col[key] = value;
        renderCompareColumns();
        generateCompareColumn(id);
    }
}

window.updateCompareSets = function(id, setId, checked) {
    const col = state.compareColumns.find(c => c.id === id);
    if (!col) return;
    
    if (checked) {
        const setObj = state.allSets.find(s => s.id === setId);
        if (setObj && !col.setSelections.some(s => s.set.id === setId)) {
            // Default 1 quantity for comparison testing
            col.setSelections.push({ set: setObj, qty: 1 });
        }
    } else {
        col.setSelections = col.setSelections.filter(s => s.set.id !== setId);
    }
    renderCompareColumns();
    generateCompareColumn(id);
}

window.updateCompareGradient = function(id, index, value) {
    const col = state.compareColumns.find(c => c.id === id);
    if (col) {
        col.gradientColors[index] = value;
        // debounce slightly for color picker
        clearTimeout(col.debounceTimer);
        col.debounceTimer = setTimeout(() => {
            generateCompareColumn(id);
        }, 500);
    }
}

window.addArenaGradientColor = function(id) {
    const col = state.compareColumns.find(c => c.id === id);
    if (!col || col.gradientColors.length >= 5) return;
    col.gradientColors.push('#888888');
    renderCompareColumns();
    clearTimeout(col.debounceTimer);
    col.debounceTimer = setTimeout(() => generateCompareColumn(id), 500);
}

window.removeArenaGradientColor = function(id, index) {
    const col = state.compareColumns.find(c => c.id === id);
    if (!col || col.gradientColors.length <= 2) return;
    col.gradientColors.splice(index, 1);
    renderCompareColumns();
    clearTimeout(col.debounceTimer);
    col.debounceTimer = setTimeout(() => generateCompareColumn(id), 500);
}

window.promoteToPrimary = function(id) {
    const col = state.compareColumns.find(c => c.id === id);
    if (!col || !col.mosaicData) return;
    
    // update global state
    state.mosaicUrl = col.mosaicUrl;
    state.mosaicData = col.mosaicData;
    
    state.setSelections = col.setSelections.map(s => ({...s}));
    renderSelectedSets();
    if (window.renderQuickChips) window.renderQuickChips();
    
    // sync global UI controls
    state.colorMode = col.colorMode;
    state.dithering = col.dithering;
    state.contrast_boost = col.contrast;
    state.gradient_colors = [...col.gradientColors];

    quickColorModeSelect.value = col.colorMode;
    quickColorModeSelect.value = col.colorMode;
    quickColorModeSelect.dispatchEvent(new Event('change')); // Syncs the UI panels (gradient vs dithering)
    
    quickDitherToggle.checked = col.dithering;
    quickDitherToggle.dispatchEvent(new Event('change'));

    // Sync adjustments directly to the store.
    state.adj_contrast = col.contrast;
    if (typeof hideReferenceLayerImmediately === 'function') {
        hideReferenceLayerImmediately();
    }
    
    if (preprocessingToggle) {
        preprocessingToggle.checked = col.preprocessing;
        preprocessingToggle.dispatchEvent(new Event('change'));
    }
    
    if (gradientColorPickers && gradientColorPickers.setColors) {
        gradientColorPickers.setColors(col.gradientColors);
    }
    if (quickGradientPickers && quickGradientPickers.setColors) {
        quickGradientPickers.setColors(col.gradientColors);
    }
    
    switchResultMode('single');
    
    renderMosaic(true); // preserve user's zoom level when promoting a compare column
    renderLegend();
    if (window.update3DMosaic) window.update3DMosaic();
}

async function generateCompareColumn(id) {
    const col = state.compareColumns.find(c => c.id === id);
    if (!col || !state.croppedImageUrl) return;
    
    col.loading = true;
    col.error = null;
    renderCompareColumns(); // shows loading state
    
    try {
        const payload = {
            url: state.croppedImageUrl,
            set_selections: col.setSelections.map(s => ({ set_id: s.set.id, qty: s.qty })),
            dithering: col.dithering,
            preprocessing: col.preprocessing,
            contrast_boost: col.contrast,
            color_mode: col.colorMode,
            gradient_colors: col.gradientColors,
        };
        
        // Pass targets so rectangular mosaics are properly processed without squashing.
        if (state.targetW) payload.target_width = state.targetW;
        if (state.targetH) payload.target_height = state.targetH;

        const res = await authFetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Generation failed');
        
        col.mosaicData = data;
        col.mosaicUrl = renderOffscreenMosaic(data.grid, data.colors, data.width, data.height);
    } catch (e) {
        console.error('Arena generation failed:', e);
        col.error = e.message.substring(0, 50);
    } finally {
        col.loading = false;
        renderCompareColumns();
    }
}

// ═════════════════════════════════════════════════
//  PROJECT MANAGEMENT — Save, List, Load, Delete
// ═════════════════════════════════════════════════

/** Build a human-friendly default project name from current state. */
function _defaultProjectName() {
    const sets = state.setSelections.map(s => s.set?.name || '').filter(Boolean);
    const setStr = sets.length > 0 ? sets.slice(0, 2).join(' + ') : 'New Mosaic';
    const now = new Date();
    const datePart = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${setStr} \u2014 ${datePart}`;
}

/** Collect all current config fields for saving. */
function _getCurrentConfig() {
    return {
        ...getPreprocessingParams(),
        dithering: quickDitherToggle?.checked ?? false,
        color_mode: quickColorModeSelect?.value ?? 'realistic',
        gradient_colors: getGradientColors(),
        target_width: state.targetW || null,
        target_height: state.targetH || null,
    };
}

/** Collect current crop state for saving. */
function _getCurrentCropState() {
    if (!cropState || !cropState.naturalW) return null;
    return {
        imgScale: cropState.imgScale,
        imgPanX: cropState.imgPanX,
        imgPanY: cropState.imgPanY,
        imgRotation: cropState.imgRotation,
        frameW: cropState.frameW,
        frameH: cropState.frameH,
    };
}

/** Build a single project card DOM element. */
function _buildProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'relative group rounded-md sm:rounded-lg overflow-hidden break-inside-avoid mb-1 sm:mb-2 bg-surface-container/30 border border-transparent hover:border-outline-variant/50 transition-colors duration-300';
    card.dataset.projectId = project.id;

    const sets = (project.set_names || []).slice(0, 2).join(', ') || 'Unknown Sets';
    const studs = project.stud_count ? `${project.stud_count.toLocaleString()} studs` : '';
    const colors = project.color_count ? `${project.color_count} colors` : '';
    const meta = [studs, colors].filter(Boolean).join(' \u00b7 ');
    const dateStr = project.updated_at
        ? new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

    const thumbSrc = project.thumbnail_url || '';
    
    let mediaHTML = '';
    if (thumbSrc) {
        mediaHTML = `<img src="${thumbSrc}" alt="${project.name}" loading="lazy" class="w-full h-auto block transform group-hover:scale-105 transition-transform duration-700 ease-out" />`;
    } else {
        mediaHTML = `<div class="w-full aspect-[4/3] flex items-center justify-center bg-surface-container-high transform group-hover:scale-105 transition-transform duration-700 ease-out">
            <span class="material-symbols-outlined text-on-surface-variant/30 text-5xl">grid_view</span>
        </div>`;
    }

    card.innerHTML = `
        ${mediaHTML}
        <!-- Interactive Overlay Layer -->
        <div class="btn-load-project absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 cursor-pointer" data-id="${project.id}">
            
            <div class="flex flex-col gap-1 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 ease-out mt-auto">
                <h3 class="font-headline font-bold text-sm text-on-surface leading-tight line-clamp-2 drop-shadow-md" title="${project.name}">${project.name}</h3>
                <p class="font-label text-[10px] uppercase tracking-widest text-primary/90 drop-shadow-md">${sets}</p>
                <div class="flex items-center justify-between mt-0.5">
                    <div class="flex flex-col gap-0.5">
                        ${meta ? `<p class="font-label text-[9px] text-on-surface-variant drop-shadow-md">${meta}</p>` : ''}
                        ${dateStr ? `<p class="font-label text-[9px] text-on-surface-variant/60 drop-shadow-md">${dateStr}</p>` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Delete Button (Positions top-right) -->
            <button class="btn-delete-project absolute top-3 right-3 w-8 h-8 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center text-on-surface hover:bg-error hover:text-on-error transition-colors" data-id="${project.id}" data-name="${project.name}" title="Delete Project">
                <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
        </div>
    `;

    // Stop propagation on delete button so it doesn't trigger open project
    const delBtn = card.querySelector('.btn-delete-project');
    if (delBtn) {
        delBtn.addEventListener('click', (e) => e.stopPropagation());
    }

    return card;
}

// ── Gallery Modal ────────────────────────────────

async function openProjectsGallery() {
    const modal = $('#projects-modal');
    const loadingEl = $('#projects-loading');
    const emptyEl = $('#projects-empty');
    if (!modal) return;

    modal.classList.remove('hidden');
    loadingEl?.classList.remove('hidden');
    emptyEl?.classList.add('hidden');

    // Reset Alpine store grid to empty/loading state
    state.projects = [];
    state.projectsError = '';
    state.projectsVisible = false;

    try {
        const res = await authFetch(`${API}/api/projects`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to load projects');

        const projects = data.projects || [];
        loadingEl?.classList.add('hidden');

        if (projects.length === 0) {
            emptyEl?.classList.remove('hidden');
            emptyEl?.classList.add('flex');
        } else {
            // Alpine store mutation — template reads $store.app.projects directly
            state.projects = projects;
            state.projectsVisible = true;
        }
    } catch (e) {
        loadingEl?.classList.add('hidden');
        console.error('openProjectsGallery failed:', e);
        state.projectsError = e.message;
        state.projectsVisible = true;
    }
}

function closeProjectsGallery() {
    $('#projects-modal')?.classList.add('hidden');
}

// ── Load (Open) Project ──────────────────────────

async function loadProject(projectId) {
    closeProjectsGallery();

    const overlay = document.createElement('div');
    overlay.id = 'project-load-overlay';
    overlay.className = 'fixed inset-0 z-[2000] bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4';
    overlay.innerHTML = '<span class="spinner" style="width:40px;height:40px;border-width:3px;color:#ff2d78"></span>' +
        '<p class="font-label text-xs uppercase tracking-widest text-on-surface-variant">Loading project\u2026</p>';
    document.body.appendChild(overlay);

    try {
        const res = await authFetch(`${API}/api/projects/${projectId}`);
        const project = await res.json();
        if (!res.ok) throw new Error(project.detail || 'Failed to load project');

        state.imageUrl = project.image_url;
        state.croppedImageUrl = project.cropped_image_url;
        state.mosaicUrl = project.thumbnail_url;
        
        // Restore history
        state.mosaicHistory = project.mosaic_history || [];
        // Ensure array holds valid layout (drop legacy if it's there but missing config)
        state.mosaicHistory = state.mosaicHistory.filter(h => h && h.config);
        state.historyIndex = state.mosaicHistory.length - 1;
        updateHistoryUI(); // Reset UI slider hooks

        // Restore set selections using allSets lookup
        state.setSelections = (project.set_selections || []).map(sel => {
            const found = state.allSets.find(s => s.id === sel.set_id);
            return found ? { set: found, qty: sel.qty || 1 } : null;
        }).filter(Boolean);
        renderSelectedSets();

        // Restore config UI
        const cfg = project.config || {};
        if (quickDitherToggle && cfg.dithering !== undefined) quickDitherToggle.checked = cfg.dithering;
        // Restore all preprocessing sliders to the store.
        state.adj_contrast = cfg.contrast_boost ?? 1.0;
        state.adj_saturation = cfg.saturation ?? 0;
        state.adj_temperature = cfg.temperature ?? 0;
        state.adj_sharpen = cfg.sharpen ?? 0.0;
        state.adj_gamma = cfg.gamma ?? 1.0;
        state.adj_black_point = cfg.black_point ?? 0;
        state.adj_white_point = cfg.white_point ?? 255;
        state.adj_posterize = cfg.posterize_levels ?? 32;
        if (quickColorModeSelect && cfg.color_mode) quickColorModeSelect.value = cfg.color_mode;
        if (cfg.target_width) state.targetW = cfg.target_width;
        if (cfg.target_height) state.targetH = cfg.target_height;

        state.mosaicData = project.mosaic_data;
        state._loadedProjectId = projectId;
        state._loadedProjectName = project.name;

        // Leave reference image unchanged to display whatever the preprocessing set it to.
        showTab('build-plan');
        applyInstantPreview(false); // Make sure the reference layer has an image src
        if (window.syncQuickConfigUI) window.syncQuickConfigUI();
        renderMosaic();
        renderLegend();
    } catch (e) {
        alert('Failed to load project: ' + e.message);
    } finally {
        document.getElementById('project-load-overlay')?.remove();
    }
}

// ── Save Project Dialog ──────────────────────────

function openSaveProjectDialog() {
    if (!state.mosaicData) {
        alert('Generate a mosaic first before saving.');
        return;
    }
    const modal = $('#save-project-modal');
    const nameInput = $('#save-project-name');
    const warningEl = $('#save-limit-warning');
    const btnSaveAs = $('#btn-confirm-save-as');
    if (!modal || !nameInput) return;

    nameInput.value = state._loadedProjectName || _defaultProjectName();
    setTimeout(() => nameInput.select(), 50);
    warningEl?.classList.add('hidden');
    
    if (state._loadedProjectId && btnSaveAs) {
        btnSaveAs.classList.remove('hidden');
        btnSaveAs.classList.add('flex');
    } else if (btnSaveAs) {
        btnSaveAs.classList.add('hidden');
        btnSaveAs.classList.remove('flex');
    }

    modal.classList.remove('hidden');
}

function closeSaveProjectDialog() {
    $('#save-project-modal')?.classList.add('hidden');
}

async function _confirmSaveProject(e, saveAsNew = false) {
    const btnConfirm = $('#btn-confirm-save');
    const btnSaveAs = $('#btn-confirm-save-as');
    
    if (btnConfirm?.disabled || btnSaveAs?.disabled) return;

    const nameInput = $('#save-project-name');
    const name = nameInput?.value?.trim() || _defaultProjectName();
    const warningEl = $('#save-limit-warning');
    const warningTextEl = $('#save-limit-warning-text');
    
    if (!state.mosaicData || !state.croppedImageUrl) return;

    const activeBtn = saveAsNew && btnSaveAs ? btnSaveAs : btnConfirm;
    
    setBtnLoading(activeBtn, true, 'Saving\u2026');
    if (btnConfirm && activeBtn !== btnConfirm) btnConfirm.disabled = true;
    if (btnSaveAs && activeBtn !== btnSaveAs) btnSaveAs.disabled = true;

    warningEl?.classList.add('hidden');

    const payload = {
        name,
        image_url: state.imageUrl || state.croppedImageUrl,
        cropped_image_url: state.croppedImageUrl,
        mosaic_preview_url: state.mosaicUrl || '',
        set_selections: state.setSelections.map(s => ({
            set_id: s.set.id,
            set_name: s.set.name || s.set.id,
            qty: s.qty,
        })),
        config: _getCurrentConfig(),
        crop_state: _getCurrentCropState(),
        mosaic_data: state.mosaicData,
        mosaic_history: state.mosaicHistory.map(h => ({
            url: h.url,
            config: h.config,
            set_selections: h.set_selections,
            crop_state: h.crop_state,
        })),
    };

    try {
        let res, data;
        if (state._loadedProjectId && !saveAsNew) {
            res = await authFetch(`${API}/api/projects/${state._loadedProjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            data = await res.json();
            if (!res.ok) {
                const d = data.detail;
                const err = new Error(typeof d === 'object' ? d.message : (d || 'Save failed'));
                err.code = typeof d === 'object' ? d.code : null;
                throw err;
            }
            state._loadedProjectName = name;
        } else {
            res = await authFetch(`${API}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            data = await res.json();
            if (!res.ok) {
                const d = data.detail;
                const err = new Error(typeof d === 'object' ? d.message : (d || 'Save failed'));
                err.code = typeof d === 'object' ? d.code : null;
                throw err;
            }
            state._loadedProjectId = data.project_id;
            state._loadedProjectName = name;
        }

        closeSaveProjectDialog();
        _showToast(saveAsNew ? 'Project created!' : 'Project saved!', 'success');
    } catch (e) {
        if (e.code === 'PROJECT_LIMIT_REACHED') {
            if (warningEl && warningTextEl) {
                warningTextEl.textContent = e.message;
                warningEl.classList.remove('hidden');
            }
        } else {
            alert('Failed to save project: ' + e.message);
        }
    } finally {
        setBtnLoading(activeBtn, false);
        if (btnConfirm && activeBtn !== btnConfirm) btnConfirm.disabled = false;
        if (btnSaveAs && activeBtn !== btnSaveAs) btnSaveAs.disabled = false;
    }
}

// ── Delete Project Dialog ────────────────────────

// Expose project helpers to window so Alpine templates can call them
window.loadProject = loadProject;
window.openDeleteProjectDialog = openDeleteProjectDialog;

let _pendingDeleteId = null;

function openDeleteProjectDialog(projectId, projectName) {
    _pendingDeleteId = projectId;
    const nameDisplay = $('#delete-project-name-display');
    if (nameDisplay) nameDisplay.textContent = projectName || 'this project';
    $('#delete-project-modal')?.classList.remove('hidden');
}

function closeDeleteProjectDialog() {
    _pendingDeleteId = null;
    $('#delete-project-modal')?.classList.add('hidden');
}

async function _confirmDeleteProject() {
    if (!_pendingDeleteId) return;
    const btn = $('#btn-confirm-delete');
    setBtnLoading(btn, true, 'Deleting\u2026');

    try {
        const res = await authFetch(`${API}/api/projects/${_pendingDeleteId}`, { method: 'DELETE' });
        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.detail || 'Delete failed');
        }
        const deletedId = _pendingDeleteId;
        closeDeleteProjectDialog();
        _showToast('Project deleted', 'info');

        // Remove card from open gallery without full reload
        document.querySelector(`[data-project-id="${deletedId}"]`)?.remove();
        const gridEl = $('#projects-grid');
        if (gridEl && gridEl.children.length === 0) {
            gridEl.classList.add('hidden');
            const emptyEl = $('#projects-empty');
            emptyEl?.classList.remove('hidden');
            emptyEl?.classList.add('flex');
        }
        if (state._loadedProjectId === deletedId) {
            state._loadedProjectId = null;
            state._loadedProjectName = null;
        }
    } catch (e) {
        alert('Failed to delete project: ' + e.message);
    } finally {
        setBtnLoading(btn, false, 'Delete');
    }
}

// ── Toast Notification ───────────────────────────

function _showToast(message, type) {
    const colorMap = {
        success: 'bg-secondary/20 border-secondary text-secondary',
        info:    'bg-primary/20 border-primary text-primary',
        error:   'bg-error/20 border-error text-error',
    };
    const iconMap = { success: 'check_circle', info: 'info', error: 'error' };
    const k = type || 'info';

    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 z-[5000] flex items-center gap-3 px-5 py-3 rounded-xl border font-label text-sm uppercase tracking-wider shadow-2xl backdrop-blur-md transition-all duration-300 opacity-0 translate-y-2 ${colorMap[k] || colorMap.info}`;
    toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${iconMap[k] || iconMap.info}</span>${message}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.remove('opacity-0', 'translate-y-2'));
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 400);
    }, 2800);
}

// ── Wire up modal event listeners (after DOM ready) ──

document.addEventListener('DOMContentLoaded', () => {
    $('#btn-close-projects-modal')?.addEventListener('click', closeProjectsGallery);
    $('#projects-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeProjectsGallery(); });

    $('#btn-close-save-modal')?.addEventListener('click', closeSaveProjectDialog);
    $('#btn-cancel-save')?.addEventListener('click', closeSaveProjectDialog);
    $('#save-project-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeSaveProjectDialog(); });
    $('#btn-confirm-save')?.addEventListener('click', (e) => _confirmSaveProject(e, false));
    $('#btn-confirm-save-as')?.addEventListener('click', (e) => _confirmSaveProject(e, true));

    $('#btn-cancel-delete')?.addEventListener('click', closeDeleteProjectDialog);
    $('#delete-project-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeDeleteProjectDialog(); });
    $('#btn-confirm-delete')?.addEventListener('click', _confirmDeleteProject);
});
