/**
 * compare.js — Comparison Arena mode
 *
 * Manages side-by-side mosaic comparison columns: add/remove columns,
 * generate per-column mosaics, promote a variant to primary view, and
 * switch between single/compare display modes.
 *
 * Extracted from result.js for modularity.
 */
import { getState } from '../store.js';
import { API, authFetch } from '../api.js';
import { hideReferenceLayerImmediately } from './preprocess.js';
import { renderOffscreenMosaic } from './generate.js';
import { renderSelectedSets } from './sets.js';

const state = new Proxy({}, {
    get(target, prop) { return getState()[prop]; },
    set(target, prop, value) { getState()[prop] = value; return true; }
});

// ═════════════════════════════════════════════════
//  COMPARISON ARENA (Mode)
// ═════════════════════════════════════════════════

// DOM refs — resolved lazily on first use to avoid timing issues
let _btnModeSingle, _btnModeCompare, _singleModeView, _compareModeView;
let _quickColorModeSelect;

/** Resolve DOM refs (called once on first use). */
function _ensureDom() {
    if (_btnModeSingle) return;
    _btnModeSingle = document.getElementById('btn-mode-single');
    _btnModeCompare = document.getElementById('btn-mode-compare');
    _singleModeView = document.getElementById('single-mode-view');
    _compareModeView = document.getElementById('compare-mode-view');
    _quickColorModeSelect = document.getElementById('quick-color-mode-select');
}

export function switchResultMode(mode) {
    _ensureDom();
    state.isCompareArena = (mode === 'compare');
    if (state.isCompareArena) {
        _btnModeSingle.classList.remove('text-primary', 'border-primary');
        _btnModeSingle.classList.add('text-on-surface-variant', 'border-transparent');

        _btnModeCompare.classList.remove('text-on-surface-variant', 'border-transparent');
        _btnModeCompare.classList.add('text-primary', 'border-primary');

        _singleModeView.classList.add('hidden');
        _singleModeView.classList.remove('flex');
        _compareModeView.classList.remove('hidden');

        // Initialize if empty
        if (state.compareColumns.length === 0) {
            addCompareColumn(true);
            addCompareColumn(false);
        }
    } else {
        _btnModeCompare.classList.remove('text-primary', 'border-primary');
        _btnModeCompare.classList.add('text-on-surface-variant', 'border-transparent');

        _btnModeSingle.classList.remove('text-on-surface-variant', 'border-transparent');
        _btnModeSingle.classList.add('text-primary', 'border-primary');

        _compareModeView.classList.add('hidden');
        _singleModeView.classList.remove('hidden');
        _singleModeView.classList.add('flex');

        if (state.mosaicData) {
            // Defer to next frame so the single-mode container is visible and has a
            // real clientWidth before renderMosaic reads mosaicWrapper.clientWidth.
            // renderMosaic(true) recalculates baseScale AND maxZoom for the current
            // container size while preserving state.zoom — the safe, DRY path.
            requestAnimationFrame(() => window.renderMosaic(true));
        }
    }
}

export function addCompareColumn(autoGenerate = false, isUserInteraction = false) {
    _ensureDom();
    if (state.compareColumns.length >= 5) {
        alert("Maximum 5 comparisons allowed.");
        return;
    }
    
    // Copy current global settings or last column's settings
    const lastCol = state.compareColumns.length > 0 ? state.compareColumns[state.compareColumns.length - 1] : null;

    let mutatePrimarySet = false;
    let mutateColorMode = false;

    if (isUserInteraction && lastCol) {
        const choice = prompt("Choose a variant mutation:\n1: Swap primary set out for another set\n2: Toggle color mode (Pop Art / Realistic)\n(Leave blank to just copy current)");
        
        if (choice === null) return; // User cancelled
        
        if (choice === '1') mutatePrimarySet = true;
        if (choice === '2') mutateColorMode = true;
    }
    
    const newCol = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        colorMode: lastCol ? lastCol.colorMode : (_quickColorModeSelect ? _quickColorModeSelect.value : 'realistic'),
        contrast: lastCol ? lastCol.contrast : state.adj_contrast,
        preprocessing: lastCol ? lastCol.preprocessing : true,
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
    

    
    if (mutateColorMode) {
        newCol.colorMode = newCol.colorMode === 'pop_art' ? 'realistic' : 'pop_art';
    }
    
    state.compareColumns.push(newCol);
    renderCompareColumns();
    if (autoGenerate) {
        generateCompareColumn(newCol.id);
    }
}

window.removeCompareColumn = removeCompareColumn;
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
window.generateCompareColumn = generateCompareColumn;
export function renderCompareColumns() {
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



window.promoteToPrimary = function(id) {
    _ensureDom();
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
    state.contrast_boost = col.contrast;

    // Guard: suppress generateMosaic() calls triggered by dispatchEvent below.
    // We already have the mosaic data from the compare column — no need to re-generate.
    window._suppressGenerate = true;

    if (_quickColorModeSelect) {
        _quickColorModeSelect.value = col.colorMode;
        _quickColorModeSelect.dispatchEvent(new Event('change'));
    }

    // Sync adjustments directly to the store.
    state.adj_contrast = col.contrast;
    if (typeof hideReferenceLayerImmediately === 'function') {
        hideReferenceLayerImmediately();
    }
    
    // Note: preprocessing state is synced via store, no toggle element exists.

    window._suppressGenerate = false;
    
    switchResultMode('single');
    
    window.renderMosaic(true); // preserve user's zoom level when promoting a compare column
    window.renderLegend();
    if (window.update3DMosaic) window.update3DMosaic();
}

async function generateCompareColumn(id) {
    // Helper: always get the live reference from state (renderCompareColumns deep-clones the array)
    const getCol = () => state.compareColumns.find(c => c.id === id);

    let col = getCol();
    if (!col || !state.croppedImageUrl) return;
    
    col.loading = true;
    col.error = null;
    renderCompareColumns(); // deep-clones → col is now stale
    
    // Build payload from current config (captured before the clone)
    const payload = {
        url: state.croppedImageUrl,
        set_selections: col.setSelections.map(s => ({ set_id: s.set.id, qty: s.qty })),

        preprocessing: col.preprocessing,
        contrast_boost: col.contrast,
        color_mode: col.colorMode,
    };
    if (state.targetW) payload.target_width = state.targetW;
    if (state.targetH) payload.target_height = state.targetH;

    try {
        const res = await authFetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Generation failed');
        
        // Re-fetch live reference after await
        col = getCol();
        if (col) {
            col.mosaicData = data;
            col.mosaicUrl = renderOffscreenMosaic(data.grid, data.colors, data.width, data.height);
        }
    } catch (e) {
        console.error('Arena generation failed:', e);
        col = getCol();
        if (col) col.error = e.message.substring(0, 50);
    } finally {
        col = getCol();
        if (col) col.loading = false;
        renderCompareColumns();
    }
}
