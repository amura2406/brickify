import { $, $$, setBtnLoading } from '../utils.js';
import { getState } from '../store.js';
import { API, authFetch } from '../api.js';

import { generateMosaic, getGradientColors } from './generate.js';
import { showTab } from './navigation.js';
import { getPreprocessingParams, applyInstantPreview } from './preprocess.js';
import { renderSelectedSets } from './sets.js';
import { cropState } from './crop.js';

// Reactive proxy alias for Alpine.store('app') — mirrors the pattern in result.js.
const state = new Proxy({}, {
    get(target, prop) { return getState()[prop]; },
    set(target, prop, value) { getState()[prop] = value; return true; }
});

// DOM refs resolved lazily (after DOMContentLoaded)
let quickColorModeSelect;

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

export async function openProjectsGallery() {
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

export function closeProjectsGallery() {
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
        if (window.updateHistoryUI) window.updateHistoryUI(); // Reset UI slider hooks

        // Restore set selections using allSets lookup
        state.setSelections = (project.set_selections || []).map(sel => {
            const found = state.allSets.find(s => s.id === sel.set_id);
            return found ? { set: found, qty: sel.qty || 1 } : null;
        }).filter(Boolean);
        if (renderSelectedSets) renderSelectedSets();

        // Restore config UI
        const cfg = project.config || {};

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
        if (applyInstantPreview) applyInstantPreview(false); // Make sure the reference layer has an image src
        if (window.syncQuickConfigUI) window.syncQuickConfigUI();
        if (window.renderMosaic) window.renderMosaic();
        if (window.renderLegend) window.renderLegend();
    } catch (e) {
        alert('Failed to load project: ' + e.message);
    } finally {
        document.getElementById('project-load-overlay')?.remove();
    }
}

// ── Save Project Dialog ──────────────────────────

export function openSaveProjectDialog() {
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
    // Resolve DOM refs now that DOM is ready
    quickColorModeSelect = $('#quick-color-mode-select');

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
