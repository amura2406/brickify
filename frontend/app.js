/**
 * BRICKIFY — Frontend Application
 * Neon Tokyo Design System
 *
 * Handles: auth flow, tab navigation, set selection,
 * image upload, square cropping, mosaic generation,
 * canvas rendering, 2D/3D/comparison view, export
 */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : '';

// ── State (reactive via Alpine.store) ──
//
// The canonical state object lives in Alpine.store('app') so Alpine components
// can access it via $store.app.* without any CustomEvent bridges.
//
// The `state` alias below is set during the `alpine:init` event so that all
// existing imperative code (state.zoom, state.setSelections, etc.) keeps working
// unchanged. Because `state` is a reference to the same reactive proxy object,
// mutations through either path are immediately visible to Alpine templates.
//
// IMPORTANT: `alpine:init` fires (for defer scripts) after app.js parses but
// before DOMContentLoaded, so `state` is guaranteed to be the store by the time
// initAppFlow() and friends run.

let state = null; // assigned to Alpine.store('app') in alpine:init below

document.addEventListener('alpine:init', () => {
    Alpine.store('app', {
        // ── Set Selection ──
        setSelections: [],  // [{set, qty}]
        allSets: [],
        setsLoading: true,

        // ── Image ──
        imageUrl: null,
        imageWidth: 0,
        imageHeight: 0,
        isSquare: false,
        croppedImageUrl: null,

        // ── Mosaic ──
        mosaicUrl: null,
        mosaicData: null,
        zoom: 1,
        baseScale: 1,
        maxZoom: 5.0,

        // ── UI Mode ──
        isDev: false,
        isCompareArena: false,
        compareColumns: [],

        // ── Target Resolution ──
        targetW: 0,
        targetH: 0,

        // ── History ──
        mosaicHistory: [],  // max 6 items (current + 5 previous)
        historyIndex: -1,

        // ── Project (set when a project is loaded/saved) ──
        _loadedProjectId: null,
        _loadedProjectName: null,

        // ── Config mirrors (synced by promoteToPrimary) ──
        colorMode: 'pop_art',
        dithering: false,
        contrast_boost: 1.0,
        gradient_colors: ['#000000', '#ff2d78', '#ffffff'],

        // ── Preprocessing Adjustments (single source of truth for all sliders) ──
        adj_contrast: 1.0,
        adj_saturation: 0,
        adj_temperature: 0,
        adj_sharpen: 0.0,
        adj_gamma: 1.0,
        adj_black_point: 0,
        adj_white_point: 255,
        adj_posterize: 32,

        // ── Recent Uploads ──
        recentImages: [],
        recentLoading: true,
        recentError: false,

        // ── Projects Gallery ──
        projects: [],
        projectsError: '',
        projectsVisible: false,
    });

    // Alias: all existing `state.*` code uses this reference.
    // This is safe because Alpine.store returns the same reactive proxy object.
    state = Alpine.store('app');
});

// ── DOM Refs ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Auth
const loginScreen = $('#login-screen');
const appContainer = $('#app-container');
const btnLoginGoogle = $('#btn-login-google');
const devBypassNotice = $('#dev-bypass-notice');

// Nav
const stepIndicators = {
    sets: $('#step-sets'),
    editor: $('#step-editor'),
    'build-plan': $('#step-build-plan')
};
const tabPanels = {
    sets: $('#tab-sets'),
    editor: $('#tab-editor'),
    'build-plan': $('#tab-build-plan')
};
const btnBackToSets = $('#btn-back-to-sets');
const btnBackToEditor = $('#btn-back-to-editor');
// Quick Settings DOM
const quickSetPicker = $('#quick-set-picker');
const quickDitherToggle = $('#quick-dither-toggle');
const quickColorModeSelect = $('#quick-color-mode-select');

// Sets tab
const setsGrid = $('#sets-grid');
const setSearch = $('#set-search');
const selectedSetsPanel = $('#selected-sets-panel');
const selectedSetsList = $('#selected-sets-list'); // kept for compat
const selectedSetsSummary = $('#selected-sets-summary'); // kept for compat
const selectedSetsThumbs = $('#selected-sets-thumbs');
const summaryColors = $('#summary-colors');
const summaryPieces = $('#summary-pieces');
const summaryGrid = $('#summary-grid');
const btnContinueSets = $('#btn-continue-sets');

// Editor tab
const stepUpload = $('#step-upload');
const stepCrop = $('#step-crop');
const stepOptions = $('#step-options');
const uploadZone = $('#upload-zone');
const fileInput = $('#file-input');
const devPathUpload = $('#dev-path-upload');
const devFilePath = $('#dev-file-path');
const btnUploadPath = $('#btn-upload-path');
const cropCanvas = $('#crop-canvas');
const cropOverlay = $('#crop-overlay');
const cropWrapper = $('#crop-wrapper');
const cropZoomValue = $('#crop-zoom-value');
const btnApplyCrop = $('#btn-apply-crop');
const btnResetCrop = $('#btn-reset-crop');
const targetResolutionSelect = $('#target-resolution-select');
const btnRotateCrop = $('#btn-rotate-crop');
const btnRotateImage = $('#btn-rotate-image');
const preprocessingToggle = { checked: true }; // UI element removed
// Legacy slider refs removed (now using Alpine.js stores)

const btnToggleAdvancedAdjustments = $('#btn-toggle-advanced-adjustments');
const advancedAdjustments = $('#advanced-adjustments');
const btnQuickToggleAdvanced = $('#btn-quick-toggle-advanced');
const quickAdvancedAdjustments = $('#quick-advanced-adjustments');
const colorModeSelect = $('#color-mode-select');
const btnGenerate = $('#btn-generate');

// Build plan tab
const mosaicCanvas = $('#mosaic-canvas');
const btnModeSingle = $('#btn-mode-single');
const btnModeCompare = $('#btn-mode-compare');
const singleModeView = $('#single-mode-view');
const compareModeView = $('#compare-mode-view');
const compareColumnsContainer = $('#compare-columns-container');
const btnAddCompareColumn = $('#btn-add-compare-column');
const gradientConfig = $('#gradient-config');
const gradientColorPickers = $('#gradient-color-pickers');
const btnAddGradientColor = $('#btn-add-gradient-color');
const quickGradientConfig = $('#quick-gradient-config');
const quickGradientPickers = $('#quick-gradient-color-pickers');
const btnQuickAddGradientColor = $('#btn-quick-add-gradient-color');
const mosaicWrapper = $('#mosaic-canvas-wrapper');
const referenceLayer = $('#reference-layer');
const referenceImage = $('#reference-image');
const comparisonSlider = $('#comparison-slider');
const legendItems = $('#legend-items');
const totalPieces = $('#total-pieces');
const legendColorCount = $('#legend-color-count');
const mosaicTitle = $('#mosaic-title');
const mosaicSubtitle = $('#mosaic-subtitle');
const btn2d = $('#btn-2d');
const btn3d = $('#btn-3d');
const comparisonDot = $('#comparison-dot');
const btnComparisonToggle = $('#btn-comparison-toggle');
const historyPeekContainer = $('#history-peek-container');
const historySlider = document.getElementById('history-slider');
const historySliderLabel = document.getElementById('history-slider-label');

// Admin
const adminModal = $('#admin-modal');
const btnCloseAdmin = $('#btn-close-admin');
const adminPendingList = $('#admin-pending-list');

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    // Timing guard: alpine:init fires before DOMContentLoaded for defer scripts,
    // so `state` should already be the Alpine store at this point.
    // Fall back to a plain object only if something went wrong (e.g. CDN failure).
    if (!state) {
        console.warn('[Brickify] Alpine store not ready — falling back to plain state object. Check Alpine CDN.');
        state = {
            setSelections: [], allSets: [], setsLoading: true, imageUrl: null, imageWidth: 0,
            imageHeight: 0, isSquare: false, croppedImageUrl: null,
            mosaicUrl: null, mosaicData: null, zoom: 1, baseScale: 1,
            maxZoom: 5.0, isDev: false, isCompareArena: false,
            compareColumns: [], targetW: 0, targetH: 0,
            mosaicHistory: [], historyIndex: -1,
            _loadedProjectId: null, _loadedProjectName: null,
            colorMode: 'pop_art', dithering: false,
            contrast_boost: 1.0, gradient_colors: ['#000000', '#ff2d78', '#ffffff'],
            adj_contrast: 1.0, adj_saturation: 0, adj_temperature: 0, adj_sharpen: 0.0,
            adj_gamma: 1.0, adj_black_point: 0, adj_white_point: 255, adj_posterize: 32,
            recentImages: [], recentLoading: true, recentError: false,
            projects: [], projectsError: '', projectsVisible: false,
        };
    }

    initAppFlow();
    setupNavTabs();
    loadSets();
    setupUpload();
    setupCrop();
    setupGenerate();
    setupPreprocessingControls();
    setupResult();
    setupSearch();

    btnContinueSets.addEventListener('click', continueFromSetSelection);
});

// ═════════════════════════════════════════════════
//  AUTH FLOW
//  bypass_login=true  → skip auth (local dev only)
//  Normal             → Firebase Google SSO + approval check
// ═════════════════════════════════════════════════

const pendingScreen    = $('#pending-screen');
const pendingUserEmail = $('#pending-user-email');
const btnPendingSignOut = $('#btn-pending-signout');

function _showOnly(screen) {
    // screen = 'login' | 'pending' | 'app'
    loginScreen.classList.add('hidden');
    pendingScreen.classList.add('hidden');
    appContainer.classList.add('hidden');
    if (screen === 'login')   loginScreen.classList.remove('hidden');
    if (screen === 'pending') pendingScreen.classList.remove('hidden');
    if (screen === 'app')     appContainer.classList.remove('hidden');
}

function _setNavUser(user) {
    const avatar = $('#nav-user-avatar');
    const name   = $('#nav-user-name');
    const email  = $('#nav-user-email');
    if (!user) return;
    const initials = (user.displayName || user.email || '?').slice(0, 2).toUpperCase();
    if (user.photoURL && avatar) {
        avatar.innerHTML = `<img src="${user.photoURL}" class="w-full h-full object-cover" alt="avatar">`;
    } else if (avatar) {
        avatar.textContent = initials;
    }
    if (name)  name.textContent  = user.displayName || '';
    if (email) email.textContent = user.email || '';

    const btnNavAdmin = $('#btn-nav-admin');
    if (btnNavAdmin) {
        if (user.isAdmin) {
            btnNavAdmin.classList.remove('hidden');
            btnNavAdmin.classList.add('flex');
        } else {
            btnNavAdmin.classList.add('hidden');
            btnNavAdmin.classList.remove('flex');
        }
    }
}

function _setupUserMenu() {
    const menuBtn      = $('#btn-user-menu');
    const menuDropdown = $('#user-menu-dropdown');
    const signOutBtn   = $('#btn-nav-signout');
    const adminBtn     = $('#btn-nav-admin');

    menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown?.classList.toggle('hidden');
    });
    document.addEventListener('click', () => menuDropdown?.classList.add('hidden'));
    signOutBtn?.addEventListener('click', () => window.BrickifyAuth.signOut());
    btnPendingSignOut?.addEventListener('click', () => window.BrickifyAuth.signOut());
    
    adminBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown?.classList.add('hidden');
        openAdminDashboard();
    });

    const projectsBtn = $('#btn-nav-projects');
    projectsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown?.classList.add('hidden');
        openProjectsGallery();
    });

    if (btnCloseAdmin) {
        btnCloseAdmin.addEventListener('click', () => {
            adminModal?.classList.add('hidden');
        });
    }
}

function initAppFlow() {
    const params = new URLSearchParams(window.location.search);
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const bypass = isLocalhost && params.get('bypass_login') === 'true';
    state.isDev = bypass;

    if (bypass) {
        _showOnly('app');
        devBypassNotice.classList.remove('hidden');
        devPathUpload.classList.remove('hidden');
        _setupUserMenu();
        showApp();
        return;
    }

    _showOnly('login');
    _setupUserMenu();

    // Wire sign-in button
    btnLoginGoogle?.addEventListener('click', async () => {
        try {
            btnLoginGoogle.disabled = true;
            btnLoginGoogle.textContent = 'Signing in…';
            await window.BrickifyAuth.signInWithGoogle();
            // onAuthStateChanged callback handles the rest
        } catch (err) {
            console.error('Sign-in error:', err);
            btnLoginGoogle.disabled = false;
            btnLoginGoogle.innerHTML = `
                <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google`;
        }
    });

    window.BrickifyAuth.initFirebaseAuth(
        // onReady — signed in + approved
        (user) => {
            _setNavUser(user);
            _showOnly('app');
            showApp();
        },
        // onPendingApproval
        (user) => {
            if (pendingUserEmail) pendingUserEmail.textContent = user.email || '';
            _showOnly('pending');
        },
        // onSignOut
        () => {
            _showOnly('login');
        }
    );
}

function showApp() {
    appContainer.classList.remove('hidden');
    showTab('sets');
    // Once app is visible and user is definitely authenticated, fetch recent uploads
    loadRecentUploads();
    // Show Google Photos button only when real Firebase auth is active (not bypass mode)
    const gphotosSection = document.getElementById('google-photos-section');
    if (gphotosSection && !state.isDev) {
        gphotosSection.classList.remove('hidden');
    }
}

// ── Authenticated fetch helper ────────────────────────────────────────────────
// All API calls should use authFetch() instead of bare fetch() in production.
async function authFetch(url, options = {}) {
    if (!state.isDev && window.BrickifyAuth) {
        const token = await window.BrickifyAuth.getIdToken();
        if (token) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return fetch(url, options);
}

// ═════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ═════════════════════════════════════════════════

async function openAdminDashboard() {
    if (adminModal) adminModal.classList.remove('hidden');
    await Promise.all([loadPendingUsers(), loadStorageUsage()]);
}

async function loadPendingUsers() {
    if (!adminPendingList) return;
    
    adminPendingList.innerHTML = `
        <div class="text-center py-8 text-on-surface-variant text-sm font-label flex flex-col items-center gap-3">
          <span class="spinner" style="width:24px;height:24px;border-width:3px;color:#ff2d78"></span>
          Loading pending users...
        </div>
    `;

    try {
        const res = await authFetch(`${API}/api/admin/pending-users`);
        if (!res.ok) throw new Error("Failed to load pending users");
        const data = await res.json();
        const pendingUsers = data.pending || [];
        
        if (pendingUsers.length === 0) {
            adminPendingList.innerHTML = `
                <div class="text-center py-8 text-on-surface-variant text-sm font-label flex flex-col items-center gap-3">
                  <span class="material-symbols-outlined text-4xl opacity-50">check_circle</span>
                  No pending users to approve
                </div>
            `;
            return;
        }

        adminPendingList.innerHTML = pendingUsers.map(u => `
            <div class="flex items-center justify-between p-4 bg-surface-container-high border border-outline-variant rounded-lg">
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-on-surface">${u.email || 'No Email'}</span>
                    <span class="text-[10px] font-label text-on-surface-variant tracking-wider uppercase mt-1">UID: ${u.uid}</span>
                </div>
                <button onclick="approveUser('${u.uid}')" class="px-4 py-2 bg-secondary/10 border border-secondary/50 text-secondary hover:bg-secondary/20 transition-colors rounded font-label text-xs uppercase tracking-wider touch-target shadow-[0_0_10px_rgba(0,255,204,0.1)]">
                    Approve
                </button>
            </div>
        `).join('');

    } catch (e) {
        console.error("Admin error:", e);
        adminPendingList.innerHTML = `
            <div class="text-center py-8 text-error text-sm font-label flex flex-col items-center gap-3">
              <span class="material-symbols-outlined text-4xl opacity-50">error</span>
              Failed to load pending users.<br>${e.message}
            </div>
        `;
    }
}

window.approveUser = async function(uid) {
    if (!confirm("Are you sure you want to approve this user?")) return;
    
    try {
        const res = await authFetch(`${API}/api/admin/approve-user`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({uid})
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Approval failed");
        }
        
        // Reload list
        await loadPendingUsers();
    } catch(e) {
        alert("Failed to approve: " + e.message);
    }
};

// ── Admin: Storage Management ─────────────────────────────────────────────────
async function loadStorageUsage() {
    const container = document.getElementById('admin-storage-info');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-4 text-on-surface-variant text-sm font-label flex flex-col items-center gap-3">
          <span class="spinner" style="width:20px;height:20px;border-width:2px;color:#ff2d78"></span>
          Loading usage…
        </div>
    `;

    try {
        const res = await authFetch(`${API}/api/admin/storage-usage`, {
            cache: 'no-store'
        });
        if (!res.ok) throw new Error('Failed to load storage usage');
        const data = await res.json();

        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        };

        const FREE_TIER_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB
        const usagePct = Math.min(100, Math.round((data.total_bytes / FREE_TIER_LIMIT) * 100));
        const isWarning = usagePct > 70;

        let prefixRows = '';
        if (data.by_prefix) {
            prefixRows = Object.entries(data.by_prefix).map(([prefix, info]) => `
                <div class="flex justify-between items-center text-xs">
                    <span class="font-label text-on-surface-variant"><code>${prefix}/</code></span>
                    <span class="font-label text-on-surface">${info.files} files · ${formatBytes(info.bytes)}</span>
                </div>
            `).join('');
        }

        container.innerHTML = `
            <div class="bg-surface-container-high border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
                <div class="flex justify-between items-center">
                    <span class="font-label text-sm text-on-surface font-bold">Total Usage</span>
                    <span class="font-headline font-bold text-lg ${isWarning ? 'text-error' : 'text-secondary'}">${formatBytes(data.total_bytes)}</span>
                </div>
                <div class="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all ${isWarning ? 'bg-error' : 'bg-secondary'}" style="width: ${usagePct}%"></div>
                </div>
                <div class="flex justify-between text-[10px] font-label text-on-surface-variant">
                    <span>${data.total_files} files across all prefixes</span>
                    <span>${usagePct}% of 5 GB free tier</span>
                </div>
                <div class="border-t border-outline-variant/30 pt-2 flex flex-col gap-1">
                    ${prefixRows}
                </div>
            </div>
            <button id="btn-purge-storage" class="w-full mt-1 px-4 py-3 bg-error/10 border border-error/50 text-error hover:bg-error/20 transition-colors rounded-lg font-label text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-sm">delete_sweep</span>
                Purge All Storage (${data.total_files} files)
            </button>
        `;

        const btnPurge = document.getElementById('btn-purge-storage');
        if (btnPurge) {
        btnPurge.addEventListener('click', async () => {
                if (!confirm(`⚠️ This will permanently delete ALL ${data.total_files} stored files. This cannot be undone. Continue?`)) return;
                
                const originalContent = btnPurge.innerHTML;
                btnPurge.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-color:currentcolor;border-bottom-color:transparent"></span> Purging...';
                btnPurge.disabled = true;
                btnPurge.classList.add('opacity-50', 'cursor-not-allowed');

                try {
                    // Kick off the async purge — returns 202 + job_id immediately
                    const delRes = await authFetch(`${API}/api/admin/storage-clear`, { method: 'DELETE' });
                    if (!delRes.ok) throw new Error('Failed to start purge');
                    const { job_id } = await delRes.json();

                    // Poll until done or error
                    const result = await (async () => {
                        for (let i = 0; i < 120; i++) {  // max ~4 min
                            await new Promise(r => setTimeout(r, 2000));
                            const poll = await authFetch(`${API}/api/admin/storage-clear/${job_id}`);
                            if (!poll.ok) throw new Error('Lost track of purge job');
                            const job = await poll.json();
                            if (job.status === 'done') return job.result;
                            if (job.status === 'error') throw new Error(job.error || 'Purge failed');
                            // still running — update label
                            btnPurge.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;border-color:currentcolor;border-bottom-color:transparent"></span> Purging (${i * 2}s)...`;
                        }
                        throw new Error('Purge timed out waiting for completion');
                    })();
                    
                    // Show success
                    container.innerHTML = `<div class="text-center py-4 text-secondary text-sm font-label flex flex-col items-center gap-2">
                        <span class="material-symbols-outlined text-3xl">check_circle</span>
                        Successfully purged ${result.deleted_count} files.
                    </div>`;
                    
                    setTimeout(async () => {
                        await loadStorageUsage();
                    }, 1500);

                } catch (e) {
                    btnPurge.innerHTML = originalContent;
                    btnPurge.disabled = false;
                    btnPurge.classList.remove('opacity-50', 'cursor-not-allowed');
                    alert('Purge failed: ' + e.message);
                }
            });
        }
    } catch (e) {
        console.error('Storage usage error:', e);
        container.innerHTML = `
            <div class="text-center py-4 text-error text-sm font-label">
                Failed to load storage usage: ${e.message}
            </div>
        `;
    }
}

// ═════════════════════════════════════════════════
//  TAB NAVIGATION
// ═════════════════════════════════════════════════
function setupNavTabs() {
    // Top steps are now read-only indicators.
    // Bind the contextual Back buttons instead.
    if (btnBackToSets) {
        btnBackToSets.addEventListener('click', () => showTab('sets'));
    }
    if (btnBackToEditor) {
        btnBackToEditor.addEventListener('click', () => showTab('editor'));
    }
}

function showTab(tabName) {
    // Make correct step glow
    Object.entries(stepIndicators).forEach(([name, el]) => {
        if (!el) return;
        const numWrap = el.querySelector('.step-num');
        if (name === tabName) {
            el.classList.add('text-primary');
            el.innerHTML = el.innerHTML.replace('bg-surface-container', 'bg-primary').replace('text-on-surface', 'text-on-primary');
            if (numWrap) {
                numWrap.classList.remove('bg-surface-container', 'border', 'border-outline-variant', 'text-on-surface');
                numWrap.classList.add('bg-primary', 'text-on-primary');
            }
            el.classList.add('drop-shadow-[0_0_8px_rgba(255,45,120,0.8)]');
        } else {
            el.classList.remove('text-primary', 'drop-shadow-[0_0_8px_rgba(255,45,120,0.8)]');
            if (numWrap) {
                numWrap.classList.remove('bg-primary', 'text-on-primary');
                numWrap.classList.add('bg-surface-container', 'border', 'border-outline-variant', 'text-on-surface');
            }
        }
    });

    // Show/hide panels
    Object.entries(tabPanels).forEach(([name, el]) => {
        if (!el) return;
        if (name === tabName) {
            el.classList.remove('hidden');
            el.style.display = 'flex';
        } else {
            el.classList.add('hidden');
            el.style.display = '';
        }
    });
}

// ═════════════════════════════════════════════════
//  STEP 1: SET SELECTION
// ═════════════════════════════════════════════════
async function loadSets() {
    try {
        const res = await fetch(`${API}/api/sets`);
        const data = await res.json();
        await renderSets(data.sets);
    } catch (e) {
        console.error('Failed to load sets:', e);
        // Flip setsLoading off so the Alpine empty-state template renders.
        // Avoid innerHTML injection — Alpine owns this DOM and discards direct writes.
        state.allSets = [];
        state.setsLoading = false;
    }
}

async function renderSets(sets) {
    // Writing directly to the reactive store — Alpine templates read $store.app.allSets
    // The input 'sets' array now contains full details from the /api/sets endpoint
    state.allSets = sets.filter(Boolean);
    state.setsLoading = false;
}

function createSetCard(set) {
    const card = document.createElement('div');
    card.className = 'set-card';
    card.dataset.id = set.id;

    const palette = set.colors.slice(0, 10).map(c =>
        `<span class="palette-dot" style="background:${c.hex}" title="${c.name.replace(/"/g, '&quot;')}: ${c.count} pcs"></span>`
    ).join('');

    const totalPiecesCount = set.colors.reduce((s, c) => s + c.count, 0);

    card.innerHTML = `
        <div class="set-card-image">
            <img src="/assets/sets/${set.id}.jpg" alt="${set.name}"
                 onerror="this.src='/assets/sets/${set.id}.png'; this.onerror=function(){this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center bg-surface-container-lowest\\'><span class=\\'material-symbols-outlined text-5xl text-on-surface-variant/30\\'>deployed_code</span></div>';}"/>
        </div>
        <div class="set-card-body">
            <div class="set-card-id">Set #${set.id}</div>
            <div class="set-card-name">${set.name}</div>
            <div class="set-card-meta">
                <div class="set-card-meta-item">
                    <span class="material-symbols-outlined">grid_on</span>
                    ${set.grid[0]}×${set.grid[1]}
                </div>
                <div class="set-card-meta-item">
                    <span class="material-symbols-outlined">palette</span>
                    ${set.colors.length} colors
                </div>
                <div class="set-card-meta-item">
                    <span class="material-symbols-outlined">category</span>
                    ${totalPiecesCount.toLocaleString()} pcs
                </div>
                <div class="set-card-meta-item set-qty-display" style="display:none">
                    <span class="material-symbols-outlined">shopping_cart</span>
                    <span class="set-qty-count">×1</span>
                </div>
            </div>
            <div class="set-card-palette">${palette}</div>
            <div class="set-card-controls">
                <div class="qty-controls">
                    <button class="qty-btn" data-action="dec" data-id="${set.id}">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <span class="qty-value">1</span>
                    <button class="qty-btn" data-action="inc" data-id="${set.id}">
                        <span class="material-symbols-outlined">add</span>
                    </button>
                </div>
                <button class="set-add-btn" data-id="${set.id}">Add Set</button>
            </div>
        </div>
    `;

    // Wire up qty buttons
    card.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const qtyEl = card.querySelector('.qty-value');
            const current = parseInt(qtyEl.textContent);
            const newQty = action === 'inc' ? current + 1 : Math.max(1, current - 1);
            qtyEl.textContent = newQty;
            // If already in cart, update
            const sel = state.setSelections.find(s => s.set.id === set.id);
            if (sel) {
                sel.qty = newQty;
                renderSelectedSets();
            }
        });
    });

    // Wire up Add/Remove button
    const addBtn = card.querySelector('.set-add-btn');
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const existing = state.setSelections.find(s => s.set.id === set.id);
        if (existing) {
            removeSetFromCart(set.id);
        } else {
            const qty = parseInt(card.querySelector('.qty-value').textContent);
            addSetToCart(set, qty);
        }
    });

    return card;
}

function addSetToCart(set, qty = 1) {
    const existing = state.setSelections.find(s => s.set.id === set.id);
    if (existing) {
        existing.qty = qty;
    } else {
        state.setSelections.push({ set, qty });
    }
    renderSelectedSets();
}

function removeSetFromCart(setId) {
    state.setSelections = state.setSelections.filter(s => s.set.id !== setId);
    renderSelectedSets();
}

function renderSelectedSets() {
    // No-op: Alpine templates read $store.app.setSelections directly.
    // Retained for call-site compatibility; state mutation already happened before
    // this is called so Alpine's reactivity picks it up automatically.
}

function getMergedSetInfo() {
    const colorMap = {};
    let maxGw = 0, maxGh = 0;
    const names = [];

    state.setSelections.forEach(sel => {
        const [gw, gh] = sel.set.grid;
        if (gw * gh > maxGw * maxGh) { maxGw = gw; maxGh = gh; }
        names.push(sel.qty > 1 ? `${sel.set.name} ×${sel.qty}` : sel.set.name);
        sel.set.colors.forEach(c => {
            if (colorMap[c.hex]) {
                colorMap[c.hex].count += c.count * sel.qty;
            } else {
                colorMap[c.hex] = { ...c, count: c.count * sel.qty };
            }
        });
    });

    const colors = Object.values(colorMap);
    return {
        name: names.join(' + '),
        grid: [maxGw, maxGh],
        totalColors: colors.length,
        totalPieces: colors.reduce((s, c) => s + c.count, 0),
        totalStuds: maxGw * maxGh,
        colors: colors,
    };
}

/**
 * Pure version of getMergedSetInfo that accepts a cart array directly.
 * Used by the Alpine selected-sets-panel component.
 */
function getMergedSetInfoFromCart(cart) {
    const colorMap = {};
    let maxGw = 0, maxGh = 0;

    (cart || []).forEach(sel => {
        const [gw, gh] = sel.set.grid;
        if (gw * gh > maxGw * maxGh) { maxGw = gw; maxGh = gh; }
        sel.set.colors.forEach(c => {
            if (colorMap[c.hex]) {
                colorMap[c.hex].count += c.count * sel.qty;
            } else {
                colorMap[c.hex] = { ...c, count: c.count * sel.qty };
            }
        });
    });

    const colors = Object.values(colorMap);
    return {
        grid: [maxGw || '—', maxGh || ''],
        totalColors: colors.length,
        totalPieces: colors.reduce((s, c) => s + c.count, 0),
    };
}

// ─── Alpine bridge helpers ─────────────────────────────────────────────────
// Exposed so Alpine templates can call back into app logic via window.*

/** Toggle a set in/out of the cart (called from set-card template). */
window.setCardToggle = function setCardToggle(setId, cardEl) {
    const existing = state.setSelections.find(s => s.set.id === setId);
    if (existing) {
        removeSetFromCart(setId);
    } else {
        const qtyEl = cardEl?.querySelector('.qty-value');
        const qty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;
        const set = state.allSets.find(s => s.id === setId);
        if (set) addSetToCart(set, qty);
    }
};

/** Adjust qty spinner on a set-card (called from qty-btn template). */
window.setCardQtyChange = function setCardQtyChange(setId, delta, cardEl) {
    const qtyEl = cardEl?.querySelector('.qty-value');
    if (!qtyEl) return;
    const current = parseInt(qtyEl.textContent, 10) || 1;
    const next = Math.max(1, current + delta);
    qtyEl.textContent = next;
    const sel = state.setSelections.find(s => s.set.id === setId);
    if (sel) {
        sel.qty = next;
        renderSelectedSets();
    }
};

/** Expose pure cart-info calculator to Alpine. */
window.getMergedSetInfoFromCart = getMergedSetInfoFromCart;

/** Handle click on a recent-upload thumbnail (called from Alpine template). */
window.handleRecentUploadClick = function handleRecentUploadClick(url) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        handleUploadResponse({
            url,
            width: img.naturalWidth,
            height: img.naturalHeight,
            is_square: img.naturalWidth === img.naturalHeight,
        });
    };
    img.onerror = () => handleUploadResponse({ url, width: 1000, height: 1000, is_square: false });
    img.src = url;
};

function getSetSelectionsPayload() {
    return state.setSelections.map(s => ({ set_id: s.set.id, qty: s.qty }));
}

function setupSearch() {
    if (!setSearch) return;
    setSearch.addEventListener('input', () => {
        const q = setSearch.value.toLowerCase();
        $$('.set-card').forEach(card => {
            const name = card.querySelector('.set-card-name')?.textContent.toLowerCase() || '';
            const id = card.dataset.id || '';
            card.style.display = (!q || name.includes(q) || id.includes(q)) ? '' : 'none';
        });
    });
}

function continueFromSetSelection() {
    if (state.setSelections.length === 0) return;
    showTab('editor');
    showEditorStep('upload');
}

// ═════════════════════════════════════════════════
//  EDITOR STEP MANAGEMENT
// ═════════════════════════════════════════════════
function showEditorStep(step) {
    // Hide all editor steps
    stepUpload.classList.add('hidden');
    stepCrop.classList.add('hidden');
    stepOptions.classList.add('hidden');

    const hints = {
        upload: 'Drop an image or click to browse',
        crop: 'Drag the square to define your mosaic area',
        options: 'Adjust settings then generate your mosaic',
    };

    if (step === 'upload') {
        stepUpload.classList.remove('hidden');
        $('#editor-hint').textContent = hints.upload;
        $('#editor-title').textContent = 'Image Editor';
        $('#editor-subtitle').textContent = 'Upload a photo to begin';
        $('#editor-title-group').classList.remove('hidden');
    } else if (step === 'crop') {
        stepCrop.classList.remove('hidden');
        stepCrop.style.display = 'flex';
        $('#editor-hint').textContent = hints.crop;
        // Hide the title group to save vertical space
        $('#editor-title-group').classList.add('hidden');
    } else if (step === 'options') {
        stepOptions.classList.remove('hidden');
        stepOptions.style.display = 'flex';
        $('#editor-hint').textContent = hints.options;
        $('#editor-title').textContent = 'Mosaic Config';
        $('#editor-subtitle').textContent = 'Fine-tune rendering settings';
        $('#editor-title-group').classList.remove('hidden');
        updateOptionsPanel();
    }
}

// ═════════════════════════════════════════════════
//  STEP 2a: UPLOAD
// ═════════════════════════════════════════════════
function setupUpload() {
    uploadZone.addEventListener('click', (e) => {
        if (e.target.closest('#dev-path-upload')) return;
        fileInput.click();
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) uploadFile(fileInput.files[0]);
    });

    // Dev bypass: direct file path
    if (btnUploadPath) {
        btnUploadPath.addEventListener('click', async (e) => {
            e.stopPropagation();
            const path = devFilePath.value.trim();
            if (!path) return;
            await uploadByPath(path);
        });
    }

    // Google Photos Picker button
    const btnGPhotos = document.getElementById('btn-google-photos');
    if (btnGPhotos) {
        btnGPhotos.addEventListener('click', (e) => {
            e.stopPropagation();
            pickFromGooglePhotos();
        });
    }
}

async function loadRecentUploads() {
    state.recentLoading = true;
    state.recentError = false;
    try {
        const res = await authFetch(`${API}/api/recent-uploads`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        state.recentImages = data.images || [];
        state.recentLoading = false;
    } catch (e) {
        console.error('Recent uploads load failed:', e);
        state.recentImages = [];
        state.recentError = true;
        state.recentLoading = false;
    }
}

async function uploadByPath(filePath) {
    setUploadLoading(true);
    try {
        const res = await authFetch(`${API}/api/upload-path`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload-path failed');
        handleUploadResponse(data);
    } catch (e) {
        console.error('Upload-path failed:', e);
        alert(`Upload failed: ${e.message}`);
    } finally {
        setUploadLoading(false);
    }
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    setUploadLoading(true);
    try {
        const res = await authFetch(`${API}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        handleUploadResponse(data);
    } catch (e) {
        console.error('Upload failed:', e);
        alert(`Upload failed: ${e.message}`);
    } finally {
        setUploadLoading(false);
    }
}

function setUploadLoading(loading) {
    const uploadContent = uploadZone.querySelector('#upload-main-content');
    if (!uploadContent) return;
    if (loading) {
        uploadContent.innerHTML = `
            <span class="spinner" style="width:40px;height:40px;border-width:3px;color:#ff2d78"></span>
            <p class="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-4">Uploading…</p>
        `;
    } else {
        uploadContent.innerHTML = `
            <span class="material-symbols-outlined text-primary/50 group-hover:text-primary transition-colors" style="font-size: 72px;">cloud_upload</span>
            <div class="text-center">
                <p class="font-headline font-bold text-lg text-on-surface mb-1">Drop your image here</p>
                <p class="font-label text-xs uppercase tracking-widest text-on-surface-variant">or click to browse • JPG, PNG, WebP</p>
            </div>
        `;
    }
}

// ── Google Photos Picker Integration ──────────────────────────────────────────

let _gphotosAbortController = null;

/**
 * Full Google Photos Picker flow:
 * 1. Get Google OAuth access token (incremental scope)
 * 2. Create Picker session via backend
 * 3. Open picker in popup
 * 4. Poll session until user finishes selection
 * 5. List selected media items
 * 6. Download first image via backend proxy
 * 7. Feed into existing handleUploadResponse()
 */
async function pickFromGooglePhotos() {
    const statusEl = document.getElementById('gphotos-status');
    const statusText = document.getElementById('gphotos-status-text');
    const cancelBtn = document.getElementById('gphotos-cancel');
    const errorEl = document.getElementById('gphotos-error');
    const errorText = document.getElementById('gphotos-error-text');
    const btn = document.getElementById('btn-google-photos');

    // Reset UI
    errorEl?.classList.add('hidden');
    statusEl?.classList.add('hidden');
    cancelBtn?.classList.add('hidden');

    // Abort controller for cancellation
    _gphotosAbortController = new AbortController();
    let pickerWindow = null;
    let pollTimer = null;

    function showStatus(text) {
        statusEl?.classList.remove('hidden');
        if (statusText) statusText.textContent = text;
    }

    function showError(text) {
        statusEl?.classList.add('hidden');
        cancelBtn?.classList.add('hidden');
        errorEl?.classList.remove('hidden');
        if (errorText) errorText.textContent = text;
        btn?.removeAttribute('disabled');
        btn?.classList.remove('opacity-50', 'pointer-events-none');
    }

    function cleanup() {
        if (pollTimer) clearTimeout(pollTimer);
        if (pickerWindow && !pickerWindow.closed) pickerWindow.close();
        statusEl?.classList.add('hidden');
        cancelBtn?.classList.add('hidden');
        btn?.removeAttribute('disabled');
        btn?.classList.remove('opacity-50', 'pointer-events-none');
        _gphotosAbortController = null;
    }

    // Wire cancel button
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            _gphotosAbortController?.abort();
            cleanup();
        };
    }

    // Disable button during flow
    btn?.setAttribute('disabled', 'true');
    btn?.classList.add('opacity-50', 'pointer-events-none');

    try {
        // Step 1: Get Google OAuth access token
        showStatus('Requesting Google Photos access...');
        let accessToken;
        try {
            accessToken = await window.BrickifyAuth.getGooglePhotosAccessToken();
        } catch (authErr) {
            if (authErr.code === 'auth/popup-closed-by-user') {
                cleanup();
                return; // User cancelled — silently abort
            }
            throw authErr;
        }

        if (_gphotosAbortController?.signal.aborted) { cleanup(); return; }

        // Step 2: Create a Picker session
        showStatus('Creating session...');
        const sessionRes = await authFetch(`${API}/api/google-photos/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken }),
        });

        if (!sessionRes.ok) {
            const errData = await sessionRes.json().catch(() => ({}));
            const errMsg = errData.detail || `Session creation failed (${sessionRes.status})`;
            // Check for "no Google Photos" error
            if (sessionRes.status === 412) {
                showError('Your Google account doesn\'t have Google Photos set up. Please use file upload instead.');
                return;
            }
            throw new Error(errMsg);
        }

        const session = await sessionRes.json();
        const sessionId = session.id;
        const pickerUri = session.pickerUri + '/autoclose';

        if (_gphotosAbortController?.signal.aborted) { cleanup(); return; }

        // Step 3: Open picker in popup
        showStatus('Opening Google Photos picker...');
        cancelBtn?.classList.remove('hidden');

        const popupWidth = 600;
        const popupHeight = 700;
        const left = Math.max(0, Math.round(screen.width / 2 - popupWidth / 2));
        const top = Math.max(0, Math.round(screen.height / 2 - popupHeight / 2));
        pickerWindow = window.open(
            pickerUri,
            'googlePhotosPicker',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (!pickerWindow) {
            showError('Popup was blocked. Please allow popups for this site and try again.');
            return;
        }

        // Step 4: Poll session status
        showStatus('Waiting for you to select a photo...');
        let pollInterval = 3000; // default 3 seconds
        let maxPolls = 200; // ~10 min timeout
        let pollCount = 0;

        const pollSession = () => new Promise((resolve, reject) => {
            async function doPoll() {
                if (_gphotosAbortController?.signal.aborted) {
                    reject(new Error('Cancelled'));
                    return;
                }

                // Check if user closed popup without selecting
                if (pickerWindow && pickerWindow.closed) {
                    // Wait one more poll to check if they actually selected before closing
                    // (the /autoclose feature closes the window after selection)
                }

                pollCount++;
                if (pollCount > maxPolls) {
                    reject(new Error('Session timed out. Please try again.'));
                    return;
                }

                try {
                    const pollRes = await authFetch(
                        `${API}/api/google-photos/session/${sessionId}`,
                        { headers: { 'X-Google-Access-Token': accessToken } }
                    );
                    if (!pollRes.ok) {
                        reject(new Error(`Polling failed (${pollRes.status})`));
                        return;
                    }
                    const pollData = await pollRes.json();

                    if (pollData.mediaItemsSet) {
                        resolve(); // User selected photos!
                        return;
                    }

                    // Use polling config if available
                    if (pollData.pollingConfig?.pollInterval) {
                        const secs = parseFloat(pollData.pollingConfig.pollInterval.replace('s', ''));
                        if (secs > 0) pollInterval = secs * 1000;
                    }
                    if (pollData.pollingConfig?.timeoutIn) {
                        const timeoutSecs = parseFloat(pollData.pollingConfig.timeoutIn.replace('s', ''));
                        if (timeoutSecs <= 0) {
                            reject(new Error('Session timed out. Please try again.'));
                            return;
                        }
                    }

                    // Check if popup is closed AND no selection was made
                    if (pickerWindow && pickerWindow.closed && pollCount > 3) {
                        reject(new Error('Picker was closed without selecting a photo.'));
                        return;
                    }

                    pollTimer = setTimeout(doPoll, pollInterval);
                } catch (e) {
                    reject(e);
                }
            }
            doPoll();
        });

        await pollSession();

        if (_gphotosAbortController?.signal.aborted) { cleanup(); return; }

        // Step 5: List selected media items
        showStatus('Loading selected photo...');
        cancelBtn?.classList.add('hidden');

        const itemsRes = await authFetch(
            `${API}/api/google-photos/session/${sessionId}/media-items`,
            { headers: { 'X-Google-Access-Token': accessToken } }
        );
        if (!itemsRes.ok) throw new Error('Failed to retrieve selected photos');
        const itemsData = await itemsRes.json();
        const items = itemsData.items || [];

        if (items.length === 0) {
            showError('No photos were selected. Please try again.');
            cleanup();
            return;
        }

        // Use the first item
        const firstItem = items[0];
        // Picker API wraps in mediaFile — extract the baseUrl
        const baseUrl = firstItem.mediaFile?.baseUrl || firstItem.baseUrl;
        if (!baseUrl) {
            showError('Could not get photo URL. Please try again.');
            cleanup();
            return;
        }

        // Step 6: Download the photo via backend proxy
        showStatus('Downloading photo...');
        const uploadRes = await authFetch(`${API}/api/google-photos/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken, base_url: baseUrl }),
        });

        if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData.detail || `Failed to download photo (${uploadRes.status})`);
        }

        const uploadData = await uploadRes.json();

        // Step 7: Feed into existing upload flow
        cleanup();
        handleUploadResponse(uploadData);

    } catch (err) {
        console.error('Google Photos flow failed:', err);
        if (err.message === 'Cancelled') {
            cleanup();
            return;
        }
        cleanup();
        showError(err.message || 'An error occurred. Please try again.');
    }
}

function handleUploadResponse(data) {
    state.imageUrl = data.url;
    state.imageWidth = data.width;
    state.imageHeight = data.height;
    state.isSquare = data.is_square;

    // Always show crop tool — even square images benefit from reframing
    showEditorStep('crop');
    initCropTool();
}

// ═════════════════════════════════════════════════
//  STEP 2b: CROP TOOL
// ═════════════════════════════════════════════════
let cropState = {
    // Image transform state (NEW: fixed frame, movable image)
    imgScale: 1,        // Current image zoom level (1 = fit-to-frame)
    imgPanX: 0,         // Image pan offset X (in display px)
    imgPanY: 0,         // Image pan offset Y (in display px)
    imgRotation: 0,     // Image rotation in degrees (0, 90, 180, 270)
    // Frame (crop area) dimensions — static, computed from target resolution
    frameW: 0, frameH: 0,
    frameX: 0, frameY: 0,
    // Drawing/display
    minImgScale: 0.1,   // Dynamic minimum scale calculated per image
    displayScale: 1,    // Ratio of display size to original image
    naturalW: 0,        // Original image natural width
    naturalH: 0,        // Original image natural height
    // Legacy compat (used by applyCrop and updateCropOverlay)
    x: 0, y: 0, w: 0, h: 0,
    maxW: 0, maxH: 0,
    targetRatio: 1,
    // Drag tracking
    dragging: false, dragStartX: 0, dragStartY: 0,
    startPanX: 0, startPanY: 0,
};

let mosaicState = {
    panX: 0, panY: 0,
    dragging: false, dragStartX: 0, dragStartY: 0,
    initialPanX: 0, initialPanY: 0,
    pinchDistance: null, initialZoom: 1
};

function setupCrop() {
    btnApplyCrop.addEventListener('click', applyCrop);
    btnResetCrop.addEventListener('click', resetCrop);

    // Mouse wheel zoom on crop area — zooms the IMAGE, not the frame
    cropWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        // Use a proportional scale factor for much finer granularity (5% increments)
        const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
        cropState.imgScale = Math.max(cropState.minImgScale, Math.min(5, cropState.imgScale * scaleFactor));
        clampImagePan();
        drawCropScene();
        updateZoomLabel();
    }, { passive: false });

    // Pinch-to-zoom on touch devices
    let initialPinchDistance = null;
    let initialScale = null;

    cropWrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            initialScale = cropState.imgScale;
        }
    }, { passive: false });

    cropWrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance !== null) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const ratio = currentDistance / initialPinchDistance;
            cropState.imgScale = Math.max(cropState.minImgScale, Math.min(5, initialScale * ratio));
            clampImagePan();
            drawCropScene();
            updateZoomLabel();
        }
    }, { passive: false });

    cropWrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialPinchDistance = null;
        }
    });

    // Rotate image button
    if (btnRotateImage) {
        btnRotateImage.addEventListener('click', () => {
            cropState.imgRotation = (cropState.imgRotation + 90) % 360;
            // Reset pan and scale on rotation
            cropState.imgScale = 1;
            cropState.imgPanX = 0;
            cropState.imgPanY = 0;
            recalcCropFrame();
            drawCropScene();
            updateZoomLabel();
        });
    }
}

function updateZoomLabel() {
    cropZoomValue.textContent = `${cropState.imgScale.toFixed(1)}×`;
}

function clampImagePan() {
    // Nothing to clamp if frame is not set
    if (!cropState.frameW) return;

    const effW = (cropState.imgRotation % 180 === 0) ? cropState.naturalW : cropState.naturalH;
    const effH = (cropState.imgRotation % 180 === 0) ? cropState.naturalH : cropState.naturalW;
    
    const renderedW = effW * cropState.displayScale * cropState.imgScale;
    const renderedH = effH * cropState.displayScale * cropState.imgScale;
    
    const maxPanX = Math.max(0, (renderedW - cropState.frameW) / 2);
    const maxPanY = Math.max(0, (renderedH - cropState.frameH) / 2);
    
    cropState.imgPanX = Math.max(-maxPanX, Math.min(maxPanX, cropState.imgPanX));
    cropState.imgPanY = Math.max(-maxPanY, Math.min(maxPanY, cropState.imgPanY));
}

function populateTargetResolutions() {
    const info = getMergedSetInfo();
    const baseW = info.grid[0];
    const baseH = info.grid[1];
    let optionsHtml = '';
    
    optionsHtml += `<option value="${baseW}x${baseH}">${baseW}×${baseH} (Default Set Size)</option>`;
    
    // We offer precomputed standard sizes if they fit within ~95% of available pieces to account for color usage imbalances.
    const standards = [
        [48, 48, "Square"],
        [48, 64, "Portrait 3:4"],
        [64, 48, "Landscape 4:3"],
        [48, 96, "Portrait 1:2"],
        [96, 48, "Landscape 2:1"],
        [80, 80, "Large Square"],
        [96, 96, "Extra Large Square"],
        [96, 144, "Gallery Portrait"],
        [144, 96, "Gallery Landscape"]
    ];

    standards.forEach(([w, h, label]) => {
        if (w === baseW && h === baseH) return;
        if (w * h <= info.totalPieces * 0.95) {
             optionsHtml += `<option value="${w}x${h}">${w}×${h} (${label})</option>`;
        }
    });
    
    if (targetResolutionSelect) {
        targetResolutionSelect.innerHTML = optionsHtml;
        targetResolutionSelect.value = `${baseW}x${baseH}`;
        
        const updateRotationButton = () => {
            if (btnRotateCrop) {
                if (state.targetW !== state.targetH) {
                    btnRotateCrop.classList.remove('hidden');
                } else {
                    btnRotateCrop.classList.add('hidden');
                }
            }
        };

        targetResolutionSelect.onchange = () => {
             const [tw, th] = targetResolutionSelect.value.split('x').map(Number);
             cropState.targetRatio = tw / th;
             state.targetW = tw;
             state.targetH = th;
             updateRotationButton();
             recalcCropMaxSize();
        };
        const [tw, th] = targetResolutionSelect.value.split('x').map(Number);
        cropState.targetRatio = tw / th;
        state.targetW = tw;
        state.targetH = th;
        updateRotationButton();
        
        if (btnRotateCrop) {
            btnRotateCrop.onclick = () => {
                const temp = state.targetW;
                state.targetW = state.targetH;
                state.targetH = temp;
                cropState.targetRatio = state.targetW / state.targetH;
                
                const newOptionVal = `${state.targetW}x${state.targetH}`;
                let found = false;
                Array.from(targetResolutionSelect.options).forEach(opt => {
                     if (opt.value === newOptionVal) {
                         targetResolutionSelect.value = newOptionVal;
                         found = true;
                     }
                });
                if (!found) {
                     const opt = document.createElement('option');
                     opt.value = newOptionVal;
                     opt.text = `${state.targetW}×${state.targetH} (Rotated)`;
                     targetResolutionSelect.add(opt);
                     targetResolutionSelect.value = newOptionVal;
                }
                recalcCropMaxSize();
                updateCropOverlay();
                updateZoomLabel();
            };
        }
    }
}

function recalcCropFrame() {
    // The frame (crop area) is STATIC and centered in the canvas.
    // Sized to fill up to 90% of the canvas to leave breathing room around the edges.
    let maxViewportW = cropCanvas.width * 0.9;
    let maxViewportH = cropCanvas.height * 0.9;
    
    // Safety check if canvas is not yet sized properly
    if (maxViewportW <= 0) maxViewportW = 540; // fallback (90% of 600)
    if (maxViewportH <= 0) maxViewportH = 360; // fallback (90% of 400)
    
    let fw = maxViewportW;
    let fh = fw / cropState.targetRatio;
    
    if (fh > maxViewportH) {
        fh = maxViewportH;
        fw = fh * cropState.targetRatio;
    }
    
    cropState.frameW = Math.round(fw);
    cropState.frameH = Math.round(fh);
    cropState.frameX = Math.round((cropCanvas.width - cropState.frameW) / 2);
    cropState.frameY = Math.round((cropCanvas.height - cropState.frameH) / 2);
    
    // Legacy compat
    cropState.maxW = fw;
    cropState.maxH = fh;
    cropState.w = fw;
    cropState.h = fh;
    cropState.x = cropState.frameX;
    cropState.y = cropState.frameY;

    // Auto-fit image scale so image fills the frame
    const effW = (cropState.imgRotation % 180 === 0) ? cropState.naturalW : cropState.naturalH;
    const effH = (cropState.imgRotation % 180 === 0) ? cropState.naturalH : cropState.naturalW;
    const scaleToFillW = fw / (effW * cropState.displayScale);
    const scaleToFillH = fh / (effH * cropState.displayScale);
    cropState.minImgScale = Math.max(scaleToFillW, scaleToFillH);
    cropState.imgScale = cropState.minImgScale;
    cropState.imgPanX = 0;
    cropState.imgPanY = 0;

    drawCropScene();
    updateZoomLabel();
}

function recalcCropMaxSize() {
    // Backward compat alias
    recalcCropFrame();
}

function initCropTool() {
    // Reset rotation for new image
    cropState.imgRotation = 0;
    cropState.imgScale = 1;
    cropState.imgPanX = 0;
    cropState.imgPanY = 0;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    img.onerror = (e) => {
        console.error("Failed to load image for cropping:", state.imageUrl, e);
        alert("Failed to load the uploaded image for cropping. This may be a networking issue or CORS block.");
    };
    
    img.src = state.imageUrl;
    
    img.onload = () => {
        requestAnimationFrame(() => {
            // Auto-detect portrait images and set initial rotation if image is taller than wide
            // (most phone photos come in landscape from the URL even if taken portrait)
            // We don't rotate here — the backend handles EXIF. Just store natural dimensions.
            cropState.naturalW = img.naturalWidth;
            cropState.naturalH = img.naturalHeight;

            // Use the maximum available screen real estate within crop-wrapper boundaries (minus the 32px padding).
            // Robust fallback: if clientWidth is 0 (layout hasn't caught up), use a 600px default (standard desktop)
            let wrapperW = cropWrapper.clientWidth;
            let wrapperH = cropWrapper.clientHeight;

            if (wrapperW <= 0) {
                console.warn("Crop wrapper width is 0, using 600px fallback. This suggests a layout race condition.");
                wrapperW = 600;
            }
            if (wrapperH <= 0) {
                console.warn("Crop wrapper height is 0, using 400px fallback. This suggests a layout race condition.");
                wrapperH = 400;
            }

            const adjustedW = wrapperW > 64 ? wrapperW - 64 : wrapperW;
            const adjustedH = wrapperH > 64 ? wrapperH - 64 : wrapperH;
            
            const dispW = adjustedW;
            const dispH = Math.max(adjustedH, 300); // minimum height so it doesn't collapse entirely
            
            cropCanvas.width = dispW;
            cropCanvas.height = dispH;
            cropCanvas.style.width = dispW + 'px';
            cropCanvas.style.height = dispH + 'px';
            
            const cropContainer = document.getElementById('crop-container');
            if (cropContainer) {
                cropContainer.style.width = dispW + 'px';
                cropContainer.style.height = dispH + 'px';
            }

            // We can just use displayScale = 1, as imgScale will automatically adjust to 
            // fill the crop frame perfectly in recalcCropFrame().
            cropState.displayScale = 1;
            // Store the loaded image for redraws
            cropState._img = img;

            populateTargetResolutions();
            recalcCropFrame();

            // Image drag (pan) listeners — user drags the IMAGE behind the fixed frame
            cropOverlay.removeEventListener('mousedown', startImageDrag);
            cropOverlay.removeEventListener('touchstart', startImageDragTouch);
            document.removeEventListener('mousemove', moveImageDrag);
            document.removeEventListener('touchmove', moveImageDragTouch);
            document.removeEventListener('mouseup', endImageDrag);
            document.removeEventListener('touchend', endImageDrag);

            cropOverlay.addEventListener('mousedown', startImageDrag);
            cropOverlay.addEventListener('touchstart', startImageDragTouch, { passive: false });
            document.addEventListener('mousemove', moveImageDrag);
            document.addEventListener('touchmove', moveImageDragTouch, { passive: false });
            document.addEventListener('mouseup', endImageDrag);
            document.addEventListener('touchend', endImageDrag);
        });
    };
}

function drawCropScene() {
    const ctx = cropCanvas.getContext('2d');
    const img = cropState._img;
    if (!img) return;

    const cw = cropCanvas.width;
    const ch = cropCanvas.height;
    const s = cropState.displayScale;

    // Clear canvas
    ctx.clearRect(0, 0, cw, ch);

    // Draw the image with current scale, pan, and rotation
    ctx.save();
    const centerX = cw / 2 + cropState.imgPanX;
    const centerY = ch / 2 + cropState.imgPanY;
    ctx.translate(centerX, centerY);
    ctx.rotate((cropState.imgRotation * Math.PI) / 180);
    ctx.scale(cropState.imgScale, cropState.imgScale);
    const drawW = img.naturalWidth * s;
    const drawH = img.naturalHeight * s;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw dark overlay outside the frame
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    // Top
    ctx.fillRect(0, 0, cw, cropState.frameY);
    // Bottom
    ctx.fillRect(0, cropState.frameY + cropState.frameH, cw, ch - cropState.frameY - cropState.frameH);
    // Left
    ctx.fillRect(0, cropState.frameY, cropState.frameX, cropState.frameH);
    // Right
    ctx.fillRect(cropState.frameX + cropState.frameW, cropState.frameY, cw - cropState.frameX - cropState.frameW, cropState.frameH);

    // Update overlay position to match frame exactly
    updateCropOverlay();
}

function updateCropOverlay() {
    cropOverlay.style.left = cropState.frameX + 'px';
    cropOverlay.style.top = cropState.frameY + 'px';
    cropOverlay.style.width = cropState.frameW + 'px';
    cropOverlay.style.height = cropState.frameH + 'px';
}

// Image drag — moves the image behind the fixed frame
function startImageDrag(e) {
    e.preventDefault();
    cropState.dragging = true;
    cropState.dragStartX = e.clientX;
    cropState.dragStartY = e.clientY;
    cropState.startPanX = cropState.imgPanX;
    cropState.startPanY = cropState.imgPanY;
}

function startImageDragTouch(e) {
    if (e.touches.length !== 1) return; // let pinch handler take over
    e.preventDefault();
    const t = e.touches[0];
    cropState.dragging = true;
    cropState.dragStartX = t.clientX;
    cropState.dragStartY = t.clientY;
    cropState.startPanX = cropState.imgPanX;
    cropState.startPanY = cropState.imgPanY;
}

function moveImageDrag(e) {
    if (!cropState.dragging) return;
    const dx = e.clientX - cropState.dragStartX;
    const dy = e.clientY - cropState.dragStartY;
    cropState.imgPanX = cropState.startPanX + dx;
    cropState.imgPanY = cropState.startPanY + dy;
    clampImagePan();
    drawCropScene();
}

function moveImageDragTouch(e) {
    if (!cropState.dragging || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - cropState.dragStartX;
    const dy = t.clientY - cropState.dragStartY;
    cropState.imgPanX = cropState.startPanX + dx;
    cropState.imgPanY = cropState.startPanY + dy;
    clampImagePan();
    drawCropScene();
}

function endImageDrag() { cropState.dragging = false; }

function resetCrop() {
    cropState.imgRotation = 0;
    cropState.imgScale = 1;
    cropState.imgPanX = 0;
    cropState.imgPanY = 0;
    recalcCropFrame();
}

async function applyCrop() {
    // Calculate the crop region in ORIGINAL image coordinates.
    // The frame is at (frameX, frameY) with size (frameW, frameH) in display space.
    // The image is drawn at center + pan, scaled by imgScale, rotated by imgRotation.
    // We need to figure out which part of the original image is visible inside the frame.

    const s = cropState.displayScale;
    const cw = cropCanvas.width;
    const ch = cropCanvas.height;

    // Center of the image in canvas coords
    const imgCenterX = cw / 2 + cropState.imgPanX;
    const imgCenterY = ch / 2 + cropState.imgPanY;

    // The effective displayed image size (after scale, in display px)
    const effW = cropState.naturalW * s * cropState.imgScale;
    const effH = cropState.naturalH * s * cropState.imgScale;

    // Top-left of the displayed image (before rotation) in canvas coords
    // After rotation, the mapping changes, but we handle rotation on the backend.
    // So we compute crop coords as if the image is at its rotated orientation.
    const rot = cropState.imgRotation % 360;
    let imgDispW, imgDispH;
    if (rot === 90 || rot === 270) {
        imgDispW = effH;
        imgDispH = effW;
    } else {
        imgDispW = effW;
        imgDispH = effH;
    }

    const imgLeft = imgCenterX - imgDispW / 2;
    const imgTop = imgCenterY - imgDispH / 2;

    // Frame position relative to the displayed (rotated) image
    const relX = cropState.frameX - imgLeft;
    const relY = cropState.frameY - imgTop;

    // Convert to original image coords (accounting for rotation on backend)
    const origScale = rot === 90 || rot === 270
        ? s * cropState.imgScale * (cropState.naturalH / (imgDispW / (s * cropState.imgScale)) )
        : s * cropState.imgScale;
    // Simpler: ratio of display size to natural size (after rotation)
    const natRotW = (rot === 90 || rot === 270) ? cropState.naturalH : cropState.naturalW;
    const natRotH = (rot === 90 || rot === 270) ? cropState.naturalW : cropState.naturalH;
    const scaleX = imgDispW / natRotW;
    const scaleY = imgDispH / natRotH;

    const x = Math.round(Math.max(0, relX / scaleX));
    const y = Math.round(Math.max(0, relY / scaleY));
    const w = Math.round(cropState.frameW / scaleX);
    const h = Math.round(cropState.frameH / scaleY);

    setBtnLoading(btnApplyCrop, true, 'Cropping…');
    try {
        const res = await authFetch(`${API}/api/crop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: state.imageUrl,
                x, y, w, h,
                rotation_degrees: cropState.imgRotation,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Crop failed');
        state.croppedImageUrl = data.url;
        
        // Reset history for the new image
        state.mosaicHistory = [];
        state.historyIndex = -1;
        updateHistoryUI(); // Clear UI dots
        
        showEditorStep('options');
    } catch (e) {
        console.error('Crop failed:', e);
        alert(`Crop failed: ${e.message}`);
    } finally {
        setBtnLoading(btnApplyCrop, false);
    }
}

// ═════════════════════════════════════════════════
//  STEP 3: OPTIONS PANEL
// ═════════════════════════════════════════════════
function updateOptionsPanel() {
    const srcImg = $('#source-preview');
    if (srcImg && state.croppedImageUrl) {
        srcImg.src = state.croppedImageUrl;
    }
    const info = getMergedSetInfo();
    const setNameLabel = $('#set-name-label');
    const gridSizeLabel = $('#grid-size-label');
    if (setNameLabel) setNameLabel.textContent = info.name;
    if (gridSizeLabel) gridSizeLabel.textContent = `${state.targetW || info.grid[0]}×${state.targetH || info.grid[1]} studs`;
}

function setupGenerate() {
    btnGenerate.addEventListener('click', generateMosaic);

    if (colorModeSelect && quickColorModeSelect) {
        colorModeSelect.addEventListener('change', () => {
            quickColorModeSelect.value = colorModeSelect.value;
            syncColorModeUI();
        });
        quickColorModeSelect.addEventListener('change', () => {
            colorModeSelect.value = quickColorModeSelect.value;
            syncColorModeUI();
        });
    }

    function reorderPreprocessingSliders(mode) {
        const isBW = mode === 'bw' || mode === 'sepia';
        const wrappers = document.querySelectorAll('div[data-adjust]');
    
        wrappers.forEach(div => {
            const adjustType = div.getAttribute('data-adjust');
            let shouldHide = false;
            let order = 0;
    
            if (isBW) {
                if (adjustType === 'saturation' || adjustType === 'temperature') shouldHide = true;
                const orders = { posterize: 1, contrast: 2, gamma: 3, black_point: 4, white_point: 5, sharpen: 6 };
                order = orders[adjustType] || 99;
            } else {
                if (adjustType === 'posterize') shouldHide = true;
                const orders = { saturation: 1, temperature: 2, contrast: 3, gamma: 4, black_point: 5, white_point: 6, sharpen: 7 };
                order = orders[adjustType] || 99;
            }
    
            if (shouldHide) {
                div.style.display = 'none';
            } else {
                div.style.display = ''; 
                div.style.order = order;
            }
        });
    }

    function syncColorModeUI() {
        const mode = colorModeSelect ? colorModeSelect.value : 'realistic';
        
        if (mode === 'gradient') {
            if (gradientConfig) gradientConfig.classList.remove('hidden');
            if (quickGradientConfig) quickGradientConfig.classList.remove('hidden');
        } else {
            if (gradientConfig) gradientConfig.classList.add('hidden');
            if (quickGradientConfig) quickGradientConfig.classList.add('hidden');
        }

        const ditheringToggle = $('#dithering-toggle');
        if (ditheringToggle) ditheringToggle.disabled = (mode !== 'realistic');
        if (quickDitherToggle) quickDitherToggle.disabled = (mode !== 'realistic');
        
        reorderPreprocessingSliders(mode);
    }
    syncColorModeUI();

    window.activePickerBtn = null;
    window.colorPopover = null;

    window.createColorPopover = function() {
        if (window.colorPopover) return window.colorPopover;
        const popover = document.createElement('div');
        popover.className = 'fixed z-[100] bg-surface-container-highest border border-outline-variant rounded-lg p-2 shadow-xl flex flex-wrap gap-2 w-64 max-h-64 overflow-y-auto hidden';
        document.body.appendChild(popover);

        // Click outside to close
        document.addEventListener('mousedown', (e) => {
            if (window.activePickerBtn && !popover.contains(e.target) && !window.activePickerBtn.contains(e.target)) {
                popover.classList.add('hidden');
                window.activePickerBtn = null;
            }
        });
        window.colorPopover = popover;
        return popover;
    }

    // Exposed globally so it can be called from Arena Column's inline onclick
    window.showColorPopover = function(btn, currentColors, availableColors, onSelect) {
        window.activePickerBtn = btn;
        window.colorPopover = window.createColorPopover();
        window.colorPopover.innerHTML = '';
        
        if (!availableColors || availableColors.length === 0) {
            window.colorPopover.innerHTML = '<p class="text-xs text-on-surface-variant p-2">No sets selected.</p>';
        } else {
            availableColors.forEach(c => {
                const hexColor = c.hex.startsWith('#') ? c.hex : '#' + c.hex;
                const isSelected = currentColors.includes(hexColor) && btn.dataset.color !== hexColor;
                
                const swatch = document.createElement('button');
                swatch.className = `w-8 h-8 rounded-full border-2 transition-transform ${isSelected ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}`;
                swatch.style.backgroundColor = hexColor;
                swatch.style.borderColor = btn.dataset.color === hexColor ? '#fff' : 'transparent';
                swatch.title = c.name;
                
                if (!isSelected) {
                    swatch.addEventListener('click', () => {
                        btn.dataset.color = hexColor;
                        btn.style.backgroundColor = hexColor;
                        window.colorPopover.classList.add('hidden');
                        window.activePickerBtn = null;
                        if (onSelect) onSelect(hexColor);
                    });
                }
                window.colorPopover.appendChild(swatch);
            });
        }

        const rect = btn.getBoundingClientRect();
        window.colorPopover.style.top = `${rect.bottom + window.scrollY + 8}px`;
        window.colorPopover.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 260)}px`;
        window.colorPopover.classList.remove('hidden');
    }

    window.handleArenaColorClick = function(btn, colId, index) {
        const col = state.compareColumns.find(c => c.id === colId);
        if (!col) return;
        
        const availableColors = col.setSelections.length > 0 
            ? col.setSelections.flatMap(s => s.set.colors || []) 
            : [{hex:'000000', name:'Black'}, {hex:'FFFFFF', name:'White'}];
            
        const uniqueColors = Array.from(new Map(availableColors.map(c => [c.hex, c])).values());
        const currentColors = col.gradientColors;
        
        window.showColorPopover(btn, currentColors, uniqueColors, (newHex) => {
            window.updateCompareGradient(colId, index, newHex);
        });
    }
        
    // Ensure sets are selected, otherwise use fallback colors or warn.
    function setupPickers(btnAdd, container) {
        if (!btnAdd || !container) return;
        
        function openPickerWithContext(btn) {
            const setInfo = getMergedSetInfo();
            const availableColors = setInfo.colors.length > 0 ? setInfo.colors : [
                { hex: '000000', name: 'Black' }, { hex: 'FFFFFF', name: 'White' }, { hex: 'FF2D78', name: 'Pink' }
            ];
            const currentColors = Array.from(container.querySelectorAll('button[data-color]')).map(b => b.dataset.color);
            window.showColorPopover(btn, currentColors, availableColors, null);
        }

        function createColorButton(initialHex) {
            const btn = document.createElement('button');
            btn.dataset.color = initialHex;
            btn.style.backgroundColor = initialHex;
            btn.className = container.id.includes('quick') 
                ? 'w-6 h-6 rounded cursor-pointer border border-outline-variant p-0 shadow-sm' 
                : 'w-8 h-8 rounded cursor-pointer border border-outline-variant p-0 shadow-sm';
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openPickerWithContext(btn);
            });

            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (container.querySelectorAll('button[data-color]').length > 2) {
                    if (window.activePickerBtn === btn) {
                        if (window.colorPopover) window.colorPopover.classList.add('hidden');
                        window.activePickerBtn = null;
                    }
                    btn.remove();
                } else {
                    alert('Minimum 2 colors required.');
                }
            });
            container.appendChild(btn);
        }

        const initialInputs = container.querySelectorAll('input[type="color"]');
        const initialColors = Array.from(initialInputs).map(i => i.value);
        
        container.setColors = function(colorsArr) {
            container.innerHTML = '';
            colorsArr.forEach(hex => createColorButton(hex));
        };
        
        container.setColors(initialColors);

        btnAdd.addEventListener('click', () => {
            const currentButtons = Array.from(container.querySelectorAll('button[data-color]'));
            if (currentButtons.length >= 5) {
                alert('Maximum 5 colors allowed for gradient mapping.');
                return;
            }
            const setInfo = getMergedSetInfo();
            const availableColors = setInfo.colors.length > 0 ? setInfo.colors : [
                { hex: '000000', name: 'Black' }, { hex: 'FFFFFF', name: 'White' }, { hex: 'FF2D78', name: 'Pink' }
            ];
            const currentColors = currentButtons.map(b => b.dataset.color);
            let defaultColor = '#cccccc';
            for (const c of availableColors) {
                const hexColor = c.hex.startsWith('#') ? c.hex : '#' + c.hex;
                if (!currentColors.includes(hexColor)) {
                    defaultColor = hexColor;
                    break;
                }
            }
            createColorButton(defaultColor);
        });
    }

    setupPickers(btnAddGradientColor, gradientColorPickers);
    setupPickers(btnQuickAddGradientColor, quickGradientPickers);
}

function getGradientColors(isQuick = false) {
    const container = isQuick ? quickGradientPickers : gradientColorPickers;
    if (!container) return ['#000000', '#ffffff'];
    return Array.from(container.querySelectorAll('button[data-color]')).map(el => el.dataset.color);
}

function getPreprocessingParams() {
    // Read from the Alpine store — single source of truth, no DOM coupling.
    return {
        preprocessing: true,
        contrast_boost:    state.adj_contrast,
        saturation:        state.adj_saturation,
        temperature:       state.adj_temperature,
        sharpen:           state.adj_sharpen,
        gamma:             state.adj_gamma,
        black_point:       state.adj_black_point,
        white_point:       state.adj_white_point,
        posterize_levels:  state.adj_posterize,
    };
}

/**
 * Restore preprocessing adjustment values from a config object into the Alpine store
 * and synchronise all slider DOM nodes (main + quick) plus their value labels.
 *
 * Store-centric: no synthetic input events → no isUserSliding side-effects.
 * Safe to call from loadProject, promoteToPrimary, and syncQuickConfigUI.
 *
 * @param {Object} cfg - Subset of keys: contrast_boost, saturation, temperature,
 *                       sharpen, gamma, black_point, white_point, posterize_levels.
 *                       Missing keys are silently skipped.
 */
// _restoreAdjustments removed (sync now atomic via store assignment)

let previewDebounceMs = 50;
let previewTimeoutId = null;

function applyInstantPreview(isManualInteraction = false) {
    clearTimeout(previewTimeoutId);
    previewTimeoutId = setTimeout(() => {
        const srcImg = $('#source-preview');
        if (!srcImg || !state.croppedImageUrl) return;

        const isQuick = $('#tab-build-plan').style.display !== 'none';
        const p = getPreprocessingParams();
        
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = state.croppedImageUrl;
        img.onload = () => {
            // Limit preview canvas size for performance
            const maxDim = 800;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            const idata = ctx.getImageData(0, 0, w, h);
            const d = idata.data;
            
            const invGamma = 1.0 / p.gamma;
            const bp = p.black_point;
            const wp = p.white_point;
            const range = (wp - bp) === 0 ? 1 : (wp - bp);
            const contrast = p.contrast_boost;
            const satFactor = 1.0 + (p.saturation / 100);
            const tempVal = p.temperature;
            
            // Precompute gamma and black/white point mapping
            const lut = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                lut[i] = 255 * Math.pow(Math.max(0, Math.min(1, (i - bp) / range)), invGamma);
            }

            for (let i = 0; i < d.length; i += 4) {
                let r = d[i], g = d[i+1], b = d[i+2];
                
                // Black/White Point + Gamma
                r = lut[r];
                g = lut[g];
                b = lut[b];
                
                // Contrast
                r = contrast * (r - 128) + 128;
                g = contrast * (g - 128) + 128;
                b = contrast * (b - 128) + 128;
                
                // Temperature (approx)
                r += tempVal;
                b -= tempVal;
                
                // Saturation
                const lum = 0.299*r + 0.587*g + 0.114*b;
                r = lum + satFactor * (r - lum);
                g = lum + satFactor * (g - lum);
                b = lum + satFactor * (b - lum);
                
                d[i] = Math.max(0, Math.min(255, r));
                d[i+1] = Math.max(0, Math.min(255, g));
                d[i+2] = Math.max(0, Math.min(255, b));
            }

            // Sharpen
            if (p.sharpen > 0) {
                const wInput = w, hInput = h;
                const sharpData = new Uint8ClampedArray(d);
                const amount = p.sharpen / 10;
                const kernel = [
                    0, -amount, 0,
                    -amount, 1 + 4 * amount, -amount,
                    0, -amount, 0
                ];
                
                for (let y = 1; y < hInput - 1; y++) {
                    for (let x = 1; x < wInput - 1; x++) {
                        let r = 0, g = 0, b = 0;
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const weight = kernel[(ky + 1) * 3 + (kx + 1)];
                                const px = ((y + ky) * wInput + (x + kx)) * 4;
                                r += sharpData[px] * weight;
                                g += sharpData[px + 1] * weight;
                                b += sharpData[px + 2] * weight;
                            }
                        }
                        const idx = (y * wInput + x) * 4;
                        d[idx] = Math.max(0, Math.min(255, r));
                        d[idx + 1] = Math.max(0, Math.min(255, g));
                        d[idx + 2] = Math.max(0, Math.min(255, b));
                    }
                }
            }
            
            ctx.putImageData(idata, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            const isQuick = $('#tab-build-plan').style.display !== 'none';
            if (!isQuick && srcImg) {
                // Editor tab preview
                const tempSrc = new Image();
                tempSrc.onload = () => {
                    srcImg.src = dataUrl;
                    srcImg.style.filter = '';
                };
                tempSrc.src = dataUrl;
            }

            if (isQuick) {
                const refImg = $('#reference-image');
                const refLayer = $('#reference-layer');
                if (refImg) {
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        refImg.src = dataUrl;
                        if (isManualInteraction && window.isUserSliding) {
                            if (refLayer) {
                                refLayer.classList.remove('hidden');
                                refLayer.style.clipPath = 'inset(0 0 0 0)'; // fully reveal temporarily
                                refLayer.style.opacity = '1';
                            }
                        }
                    };
                    tempImg.src = dataUrl;
                }
            }
        };
    }, previewDebounceMs);
}

window._onSliderInput = () => {
    applyInstantPreview(true);
};

window._onSliderChange = () => {
    const isQuick = $('#tab-build-plan').style.display !== 'none';
    if (!isQuick) {
        applyInstantPreview(true);
    } else {
        hideReferenceLayerImmediately();
        generateMosaic();
    }
};

function setupPreprocessingControls() {
    [btnToggleAdvancedAdjustments, btnQuickToggleAdvanced].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            const isQ = e.target.id.includes('quick');
            const panel = isQ ? quickAdvancedAdjustments : advancedAdjustments;
            if (panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
                e.target.textContent = '- Hide Advanced';
            } else {
                panel.classList.add('hidden');
                e.target.textContent = '+ Advanced Adjustments';
            }
        });
    });
}



async function generateMosaic() {
    // Show a loading state gracefully whether on Editor or Build Plan
    if (btnGenerate) setBtnLoading(btnGenerate, true, 'Processing…');
    const loadingOverlay = document.createElement('div');
    if ($('#tab-build-plan').style.display !== 'none') {
        loadingOverlay.className = 'absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center';
        loadingOverlay.innerHTML = '<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>';
        $('#mosaic-canvas-wrapper').appendChild(loadingOverlay);
    }

    // Capture whether a mosaic already exists — if so, this is a re-generation
    // (e.g. user changed LEGO sets or tweaked config) and we should keep their zoom.
    const isRegeneration = !!state.mosaicData;

    try {
        const isQuickCol = quickColorModeSelect && quickColorModeSelect.value === 'gradient';
        const res = await authFetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: state.croppedImageUrl,
                set_selections: getSetSelectionsPayload(),
                dithering: $('#dithering-toggle').checked,
                ...getPreprocessingParams(),
                color_mode: colorModeSelect ? colorModeSelect.value : 'realistic',
                gradient_colors: isQuickCol ? getGradientColors(true) : getGradientColors(),
                target_width: state.targetW || null,
                target_height: state.targetH || null,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

        state.mosaicData = data;
        state.mosaicUrl = renderOffscreenMosaic(data.grid, data.colors, data.width, data.height);

        // Update history
        if (state.historyIndex < state.mosaicHistory.length - 1) {
            state.mosaicHistory = state.mosaicHistory.slice(0, state.historyIndex + 1);
        }
        state.mosaicHistory.push({
            data: data,
            url: state.mosaicUrl,
            config: _getCurrentConfig(),
            set_selections: JSON.parse(JSON.stringify(state.setSelections)),
            crop_state: _getCurrentCropState()
        });
        if (state.mosaicHistory.length > 6) { // Current + 5 previous
            state.mosaicHistory.shift();
        }
        state.historyIndex = state.mosaicHistory.length - 1;
        updateHistoryUI(); // Update UI dots

        // Leave referenceImage.src as the processed version assigned in applyInstantPreview
        // Do not reset it to plain croppedImageUrl here!

        showTab('build-plan');
        applyInstantPreview(false); // Make sure the reference layer has an image src

        // Ensure UI is synced with current data
        if (window.syncQuickConfigUI) window.syncQuickConfigUI();

        renderMosaic(isRegeneration); // preserve zoom when re-generating (set change, config tweak)
        renderLegend();
        hideReferenceLayerImmediately();

        // Update 3D model if it's currently active
        // Wait for canvas to be visible to avoid size issues
        setTimeout(() => {
            if (document.getElementById('3d-canvas-container').style.display !== 'none' && window.update3DMosaic) {
                window.update3DMosaic();
            }
        }, 50);
    } catch (e) {
        console.error('Generation failed:', e);
        alert('Mosaic generation failed: ' + e.message);
    } finally {
        if (btnGenerate) setBtnLoading(btnGenerate, false);
        if (loadingOverlay.parentNode) loadingOverlay.remove();
    }
}

function renderOffscreenMosaic(grid, colors, width, height) {
    const canvas = document.createElement('canvas');
    const studSize = 15;
    const padding = 1;
    const cell = studSize + padding;

    canvas.width = width * cell + padding;
    canvas.height = height * cell + padding;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    return canvas.toDataURL('image/png');
}

function updateHistoryUI() {
    if (!historyPeekContainer || !historySlider) return;
    
    const histLen = state.mosaicHistory.length;
    // Only show if we have > 1 item in history
    if (histLen <= 1) {
        historyPeekContainer.classList.add('opacity-0', 'pointer-events-none');
        return;
    }
    
    historyPeekContainer.classList.remove('opacity-0', 'pointer-events-none');
    
    // Slider: 0 = current, negative values = steps back
    // Range: min = -(histLen-1), max = 0, value = 0
    const maxBack = Math.min(histLen - 1, 5); // Cap at 5 history steps
    historySlider.min = -maxBack;
    historySlider.max = 0;
    historySlider.value = 0;
    historySliderLabel.textContent = '0';
    
    
    if (window.historySliderController) {
        window.historySliderController.abort();
    }
    window.historySliderController = new AbortController();
    const opts = { signal: window.historySliderController.signal };
    
    const slider = historySlider;
    const label = historySliderLabel;
    
    let isPeeking = false;
    
    slider.addEventListener('input', () => {
        const val = parseInt(slider.value);
        label.textContent = val === 0 ? '0' : val.toString();
        
        if (val === 0) {
            // Current mosaic
            if (isPeeking) {
                isPeeking = false;
                renderMosaic(true); // preserve user's zoom level
            }
            return;
        }
        
        // Show historical mosaic
        isPeeking = true;
        const idx = state.mosaicHistory.length - 1 + val; // val is negative
        if (idx >= 0 && idx < state.mosaicHistory.length) {
            const pastItem = state.mosaicHistory[idx];
            const ctx = mosaicCanvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, mosaicCanvas.width, mosaicCanvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = pastItem.url;
        }
    }, opts);
    
    // Snap back to 0 on release (mouse or touch)
    const snapBack = () => {
        slider.value = 0;
        label.textContent = '0';
        if (isPeeking) {
            isPeeking = false;
            renderMosaic(true); // preserve user's zoom level
        }
    };
    
    slider.addEventListener('mouseup', snapBack, opts);
    slider.addEventListener('touchend', snapBack, opts);
    slider.addEventListener('mouseleave', () => {
        // Only snap if the user was dragging (slider was not at 0)
        if (parseInt(slider.value) !== 0) snapBack();
    }, opts);
}
// ═════════════════════════════════════════════════
//  STEP 4: BUILD PLAN — MOSAIC RENDER
// ═════════════════════════════════════════════════
function renderMosaic(preserveZoom = false) {
    const { grid, colors, width, height } = state.mosaicData;
    const studSize = 15;
    const padding = 1;
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

    const info = getMergedSetInfo();
    mosaicTitle.textContent = info.name.toUpperCase();
    mosaicSubtitle.textContent = `${width}×${height} • ${(width * height).toLocaleString()} studs`;

    const wrapperWidth = mosaicWrapper.clientWidth - 32;
    state.baseScale = Math.min(1, Math.max(0.01, wrapperWidth / mosaicCanvas.width));
    
    // Default zoom: 1.0 = "100%" which visually corresponds to 35% of full-resolution.
    // Only reset if this is a fresh render (new generation or project load).
    // When preserveZoom=true (e.g. history peek snap-back), keep whatever the user set.
    if (!preserveZoom) state.zoom = 1.0;
    
    // maxZoom is a fixed 5.0 (500%) — the slider's own max="500" in HTML already
    // enforces this upper bound. We used to cap dynamically at 1.0/baseScale
    // ("native 1:1 pixel resolution") but that made the slider feel broken for
    // large mosaics where 1:1 is only 160%, leaving most of the slider track dead.
    state.maxZoom = 3.0;

    if (typeof mosaicState !== 'undefined') {
        mosaicState.panX = 0;
        mosaicState.panY = 0;
    }
    applyZoom();
}

// The "default scale factor" — zoom=1.0 displays the canvas at 35% of its full resolution.
// This makes 100% in the UI = a comfortable default view.
const DEFAULT_SCALE_FACTOR = 0.35;

function applyZoom() {
    const scale = state.baseScale * DEFAULT_SCALE_FACTOR * state.zoom;
    const cw = mosaicCanvas.width * scale;
    const ch = mosaicCanvas.height * scale;
    
    // Scale the canvas via CSS properties directly
    mosaicCanvas.style.width = cw + 'px';
    mosaicCanvas.style.height = ch + 'px';
    
    // Exact match for the comparison slider container so it shrinks naturally
    const wrapper = $('#comparison-wrapper');
    wrapper.style.width = cw + 'px';
    wrapper.style.height = ch + 'px';
    wrapper.style.margin = 'auto';
    wrapper.style.transform = `translate(${mosaicState.panX}px, ${mosaicState.panY}px)`;

    // Note: zoom-label text content is now handled reactively via Alpine x-text
    // binding in index.html ($store.app.zoom), so no manual DOM update is needed here.
    
    // Sync zoom slider + popover label if they exist
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomPopoverLabel = document.getElementById('zoom-popover-label');
    if (zoomSlider) zoomSlider.value = Math.round(state.zoom * 100);
    if (zoomPopoverLabel) zoomPopoverLabel.textContent = Math.round(state.zoom * 100) + '%';
}

function renderLegend() {
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
    totalPieces.textContent = totalLabel;
    legendColorCount.textContent = `${colors.filter(c => c.used > 0).length}`;
}

// ═════════════════════════════════════════════════
//  BUILD PLAN: CONTROLS (2D/3D, Comparison, Zoom)
// ═════════════════════════════════════════════════
function setupResult() {
    if (window.__resultEventsBound) {
        syncQuickConfigUI();
        return;
    }
    window.__resultEventsBound = true;

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
    // Close popover when clicking outside modal content
    document.addEventListener('click', (e) => {
        const modalContent = document.getElementById('quick-add-set-modal-content');
        const isClickingModal = modalContent && modalContent.contains(e.target);
        const isClickingBtn = e.target === quickAddSetBtn || quickAddSetBtn.contains(e.target);
        const isHidden = quickAddPopover.classList.contains('hidden');
        
        if (!isHidden && !isClickingModal && !isClickingBtn) {
            window._replaceSetIdx = undefined;
            quickAddPopover.classList.add('hidden');
            quickAddPopover.style.display = '';
        }
    });
    // Search filter
    quickAddSearch.addEventListener('input', () => buildQuickAddList(quickAddSearch.value));
    // ───────────────────────────────────────────────────────────────────────────

    function syncQuickConfigUI() {
        renderQuickChips();
        quickDitherToggle.checked = $('#dithering-toggle').checked;
        if (quickColorModeSelect && colorModeSelect) {
            quickColorModeSelect.value = colorModeSelect.value;
        }
        // With Alpine.js binding, store changes automatically reflect in the UI.
    }
    window.syncQuickConfigUI = syncQuickConfigUI;
    syncQuickConfigUI();

    quickDitherToggle.addEventListener('change', () => {
        $('#dithering-toggle').checked = quickDitherToggle.checked;
        hideReferenceLayerImmediately();
        generateMosaic();
    });
    if (quickColorModeSelect) {
        quickColorModeSelect.addEventListener('change', () => {
            if (colorModeSelect) colorModeSelect.value = quickColorModeSelect.value;
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
function toggleComparison() {
    isComparisonActive = !isComparisonActive;
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
    state = { setSelections: [], allSets: state.allSets, imageUrl: null, imageWidth: 0, imageHeight: 0, isSquare: false, croppedImageUrl: null, mosaicUrl: null, mosaicData: null, zoom: 1, baseScale: 1, isDev: state.isDev, compareColumns: [], isCompareArena: false, targetW: 0, targetH: 0 };
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
        colorMode: lastCol ? lastCol.colorMode : (colorModeSelect ? colorModeSelect.value : 'realistic'),
        dithering: lastCol ? lastCol.dithering : $('#dithering-toggle').checked,
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

    colorModeSelect.value = col.colorMode;
    quickColorModeSelect.value = col.colorMode;
    colorModeSelect.dispatchEvent(new Event('change')); // Syncs the UI panels (gradient vs dithering)
    
    $('#dithering-toggle').checked = col.dithering;
    quickDitherToggle.checked = col.dithering;
    $('#dithering-toggle').dispatchEvent(new Event('change'));

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
        dithering: $('#dithering-toggle')?.checked ?? false,
        color_mode: colorModeSelect?.value ?? 'realistic',
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
        if ($('#dithering-toggle') && cfg.dithering !== undefined) $('#dithering-toggle').checked = cfg.dithering;
        // Restore all preprocessing sliders to the store.
        state.adj_contrast = cfg.contrast_boost ?? 1.0;
        state.adj_saturation = cfg.saturation ?? 0;
        state.adj_temperature = cfg.temperature ?? 0;
        state.adj_sharpen = cfg.sharpen ?? 0.0;
        state.adj_gamma = cfg.gamma ?? 1.0;
        state.adj_black_point = cfg.black_point ?? 0;
        state.adj_white_point = cfg.white_point ?? 255;
        state.adj_posterize = cfg.posterize_levels ?? 32;
        if (colorModeSelect && cfg.color_mode) colorModeSelect.value = cfg.color_mode;
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
