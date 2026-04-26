import { $ } from '../utils.js';
import { getState } from '../store.js';
import { API, authFetch } from '../api.js';
import { hideReferenceLayerImmediately } from './preprocess.js';
import { generateMosaic, renderOffscreenMosaic } from './generate.js';
import { showTab } from './navigation.js';
import { renderSelectedSets } from './sets.js';
import { openSaveProjectDialog } from './project.js';
import { init3DScene } from './viewer-3d.js';
import { switchResultMode, addCompareColumn, renderCompareColumns } from './compare.js';
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
let quickColorModeSelect;

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


    if (quickColorModeSelect) {
        quickColorModeSelect.addEventListener('change', () => {
            if (window._suppressGenerate) return;
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

        // FIX: Ensure reference image has a valid src before showing
        const refImg = $('#reference-image');
        if (refImg && (!refImg.src || refImg.src === window.location.href)) {
            // src is empty — set it from the cropped image URL as a baseline
            const croppedUrl = state.croppedImageUrl;
            if (croppedUrl) {
                refImg.src = croppedUrl;
            }
        }
        
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
