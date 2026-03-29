/**
 * BRICKIFY — Frontend Application
 * Neon Tokyo Design System
 *
 * Handles: auth flow, tab navigation, set selection,
 * image upload, square cropping, mosaic generation,
 * canvas rendering, 2D/3D/comparison view, export
 */

const API = '';

// ── State ──
let state = {
    setSelections: [],  // [{set, qty}]
    allSets: [],
    imageUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    isSquare: false,
    croppedImageUrl: null,
    mosaicUrl: null,
    mosaicData: null,
    zoom: 1,
    baseScale: 1,
    isDev: false,
};

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
const quickContrastSlider = $('#quick-contrast-slider');
const quickContrastValue = $('#quick-contrast-value');

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
const cropZoomSlider = $('#crop-zoom-slider');
const cropZoomValue = $('#crop-zoom-value');
const btnApplyCrop = $('#btn-apply-crop');
const btnResetCrop = $('#btn-reset-crop');
const preprocessingToggle = $('#preprocessing-toggle');
const contrastSlider = $('#contrast-slider');
const contrastValue = $('#contrast-value');
const contrastGroup = $('#contrast-group');
const palettePreview = $('#palette-preview');
const palettePreviewContainer = $('#palette-preview-container');
const btnPreviewPalette = $('#btn-preview-palette');
const btnGenerate = $('#btn-generate');

// Build plan tab
const mosaicCanvas = $('#mosaic-canvas');
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

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
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
}

function _setupUserMenu() {
    const menuBtn      = $('#btn-user-menu');
    const menuDropdown = $('#user-menu-dropdown');
    const signOutBtn   = $('#btn-nav-signout');

    menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown?.classList.toggle('hidden');
    });
    document.addEventListener('click', () => menuDropdown?.classList.add('hidden'));
    signOutBtn?.addEventListener('click', () => window.BrickifyAuth.signOut());
    btnPendingSignOut?.addEventListener('click', () => window.BrickifyAuth.signOut());
}

function initAppFlow() {
    const params = new URLSearchParams(window.location.search);
    const bypass = params.get('bypass_login') === 'true';
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
        setsGrid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant">
                <span class="material-symbols-outlined text-5xl text-primary/40">wifi_off</span>
                <p class="font-label text-sm uppercase tracking-widest">Failed to load sets. Is the server running?</p>
            </div>
        `;
    }
}

async function renderSets(sets) {
    const details = await Promise.all(
        sets.map(s => fetch(`${API}/api/sets/${s.id}`).then(r => r.json()))
    );

    state.allSets = details;
    setsGrid.innerHTML = '';

    details.forEach((set) => {
        const card = createSetCard(set);
        setsGrid.appendChild(card);
    });
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
    // Update card states
    $$('.set-card').forEach(card => {
        const id = card.dataset.id;
        const sel = state.setSelections.find(s => s.set.id === id);
        const addBtn = card.querySelector('.set-add-btn');
        const qtyDisplay = card.querySelector('.set-qty-display');

        if (sel) {
            card.classList.add('in-cart');
            if (addBtn) { addBtn.textContent = 'Remove'; addBtn.classList.add('added'); }
            if (qtyDisplay) { qtyDisplay.style.display = 'flex'; qtyDisplay.querySelector('.set-qty-count').textContent = `×${sel.qty}`; }
        } else {
            card.classList.remove('in-cart');
            if (addBtn) { addBtn.textContent = 'Add Set'; addBtn.classList.remove('added'); }
            if (qtyDisplay) { qtyDisplay.style.display = 'none'; }
        }
    });

    if (state.setSelections.length === 0) {
        selectedSetsPanel.classList.add('hidden');
        return;
    }

    selectedSetsPanel.classList.remove('hidden');

    // Update summary numbers
    const info = getMergedSetInfo();
    summaryColors.textContent = info.totalColors;
    summaryPieces.textContent = info.totalPieces.toLocaleString();
    summaryGrid.textContent = `${info.grid[0]}×${info.grid[1]}`;

    // Render thumbnails
    selectedSetsThumbs.innerHTML = state.setSelections.map(sel => `
        <img src="/assets/sets/${sel.set.id}.jpg" alt="${sel.set.name}"
             onerror="this.src='/assets/sets/${sel.set.id}.png'; this.onerror=null;"
             class="w-10 h-10 rounded-full border-2 border-background object-cover" title="${sel.set.name} ×${sel.qty}"/>
    `).join('');
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
    };
}

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
    clearPalettePreview();
    showTab('editor');
    showEditorStep('upload');
}

function clearPalettePreview() {
    if (palettePreview) {
        palettePreview.classList.add('hidden');
        palettePreview.src = '';
    }
    const placeholder = palettePreviewContainer?.querySelector('.palette-preview-placeholder');
    if (placeholder) placeholder.style.display = '';
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
    } else if (step === 'crop') {
        stepCrop.classList.remove('hidden');
        stepCrop.style.display = 'flex';
        $('#editor-hint').textContent = hints.crop;
        $('#editor-title').textContent = 'Crop & Frame';
        $('#editor-subtitle').textContent = 'Select the square region for your mosaic';
    } else if (step === 'options') {
        stepOptions.classList.remove('hidden');
        stepOptions.style.display = 'flex';
        $('#editor-hint').textContent = hints.options;
        $('#editor-title').textContent = 'Mosaic Config';
        $('#editor-subtitle').textContent = 'Fine-tune rendering settings';
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

function handleUploadResponse(data) {
    state.imageUrl = data.url;
    state.imageWidth = data.width;
    state.imageHeight = data.height;
    state.isSquare = data.is_square;

    if (!data.is_square) {
        showEditorStep('crop');
        initCropTool();
    } else {
        state.croppedImageUrl = data.url;
        showEditorStep('options');
    }
}

// ═════════════════════════════════════════════════
//  STEP 2b: CROP TOOL
// ═════════════════════════════════════════════════
let cropState = {
    x: 0, y: 0, size: 0,
    dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0,
    displayScale: 1, canvasOffsetX: 0, maxSize: 0,
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

    cropZoomSlider.addEventListener('input', () => {
        setCropZoom(parseInt(cropZoomSlider.value));
    });

    cropWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        const newPct = Math.max(10, Math.min(100, parseInt(cropZoomSlider.value) - delta));
        cropZoomSlider.value = newPct;
        setCropZoom(newPct);
    }, { passive: false });

    let initialPinchDistance = null;
    let initialZoomValue = null;

    cropWrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2 && e.target.id !== 'comparison-slider') {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            initialZoomValue = parseInt(cropZoomSlider.value);
        }
    }, { passive: false });

    cropWrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDistance !== null) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const zoomDelta = (currentDistance - initialPinchDistance) / 2;
            const newPct = Math.max(10, Math.min(100, initialZoomValue + zoomDelta));
            cropZoomSlider.value = newPct;
            setCropZoom(newPct);
        }
    }, { passive: false });

    cropWrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialPinchDistance = null;
        }
    });
}

function setCropZoom(pct) {
    const maxSize = cropState.maxSize;
    const minSize = Math.max(20, maxSize * 0.1);
    const newSize = minSize + (maxSize - minSize) * (pct / 100);
    const centerX = cropState.x + cropState.size / 2;
    const centerY = cropState.y + cropState.size / 2;
    cropState.size = Math.round(newSize);
    cropState.x = Math.max(0, Math.min(Math.round(centerX - cropState.size / 2), cropCanvas.width - cropState.size));
    cropState.y = Math.max(0, Math.min(Math.round(centerY - cropState.size / 2), cropCanvas.height - cropState.size));
    updateCropOverlay();
    updateZoomLabel();
}

function updateZoomLabel() {
    const zoom = cropState.maxSize / cropState.size;
    cropZoomValue.textContent = `${zoom.toFixed(1)}×`;
}

function initCropTool() {
    const ctx = cropCanvas.getContext('2d');
    const img = new window.Image();
    
    img.onerror = (e) => {
        console.error("Failed to load image for cropping:", state.imageUrl, e);
        alert("Failed to load the uploaded image for cropping. This may be a networking issue or CORS block.");
    };
    
    img.src = state.imageUrl;
    
    img.onload = () => {
        const wrapperW = cropWrapper.clientWidth - 64;
        const maxH = 500;
        let scale = Math.min(wrapperW / img.width, maxH / img.height, 1);
        const dispW = Math.round(img.width * scale);
        const dispH = Math.round(img.height * scale);

        cropCanvas.width = dispW;
        cropCanvas.height = dispH;
        cropCanvas.style.width = dispW + 'px';
        cropCanvas.style.height = dispH + 'px';
        const cropContainer = document.getElementById('crop-container');
        if (cropContainer) {
            cropContainer.style.width = dispW + 'px';
            cropContainer.style.height = dispH + 'px';
        }

        ctx.drawImage(img, 0, 0, dispW, dispH);
        cropState.displayScale = scale;

        const minDim = Math.min(dispW, dispH);
        cropState.maxSize = minDim;
        cropState.size = minDim;
        cropState.x = (dispW - minDim) / 2;
        cropState.y = (dispH - minDim) / 2;

        cropZoomSlider.value = 100;
        updateCropOverlay();
        updateZoomLabel();

        // Remove old listeners
        cropOverlay.removeEventListener('mousedown', startCropDrag);
        cropOverlay.removeEventListener('touchstart', startCropDragTouch);
        document.removeEventListener('mousemove', moveCropDrag);
        document.removeEventListener('touchmove', moveCropDragTouch);
        document.removeEventListener('mouseup', endCropDrag);
        document.removeEventListener('touchend', endCropDrag);

        cropOverlay.addEventListener('mousedown', startCropDrag);
        cropOverlay.addEventListener('touchstart', startCropDragTouch, { passive: false });
        document.addEventListener('mousemove', moveCropDrag);
        document.addEventListener('touchmove', moveCropDragTouch, { passive: false });
        document.addEventListener('mouseup', endCropDrag);
        document.addEventListener('touchend', endCropDrag);
    };
}

function updateCropOverlay() {
    cropOverlay.style.left = cropState.x + 'px';
    cropOverlay.style.top = cropState.y + 'px';
    cropOverlay.style.width = cropState.size + 'px';
    cropOverlay.style.height = cropState.size + 'px';
}

function startCropDrag(e) {
    e.preventDefault();
    cropState.dragging = true;
    cropState.dragStartX = e.clientX;
    cropState.dragStartY = e.clientY;
    cropState.startX = cropState.x;
    cropState.startY = cropState.y;
}

function startCropDragTouch(e) {
    e.preventDefault();
    const t = e.touches[0];
    cropState.dragging = true;
    cropState.dragStartX = t.clientX;
    cropState.dragStartY = t.clientY;
    cropState.startX = cropState.x;
    cropState.startY = cropState.y;
}

function moveCropDrag(e) {
    if (!cropState.dragging) return;
    moveCrop(e.clientX - cropState.dragStartX, e.clientY - cropState.dragStartY);
}

function moveCropDragTouch(e) {
    if (!cropState.dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    moveCrop(t.clientX - cropState.dragStartX, t.clientY - cropState.dragStartY);
}

function moveCrop(dx, dy) {
    cropState.x = Math.max(0, Math.min(cropState.startX + dx, cropCanvas.width - cropState.size));
    cropState.y = Math.max(0, Math.min(cropState.startY + dy, cropCanvas.height - cropState.size));
    updateCropOverlay();
}

function endCropDrag() { cropState.dragging = false; }

function resetCrop() {
    const minDim = Math.min(cropCanvas.width, cropCanvas.height);
    cropState.maxSize = minDim;
    cropState.size = minDim;
    cropState.x = (cropCanvas.width - minDim) / 2;
    cropState.y = (cropCanvas.height - minDim) / 2;
    cropZoomSlider.value = 100;
    updateCropOverlay();
    updateZoomLabel();
}

async function applyCrop() {
    const scale = cropState.displayScale;
    const x = Math.round(cropState.x / scale);
    const y = Math.round(cropState.y / scale);
    const size = Math.round(cropState.size / scale);

    setBtnLoading(btnApplyCrop, true, 'Cropping…');
    try {
        const res = await authFetch(`${API}/api/crop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: state.imageUrl, x, y, size }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Crop failed');
        state.croppedImageUrl = data.url;
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
    if (gridSizeLabel) gridSizeLabel.textContent = `${info.grid[0]}×${info.grid[1]} studs`;
}

function setupGenerate() {
    btnGenerate.addEventListener('click', generateMosaic);
    btnPreviewPalette.addEventListener('click', previewPalette);
}

function setupPreprocessingControls() {
    contrastSlider.addEventListener('input', () => {
        contrastValue.textContent = `${parseFloat(contrastSlider.value).toFixed(1)}×`;
    });
    preprocessingToggle.addEventListener('change', () => {
        const enabled = preprocessingToggle.checked;
        contrastGroup.style.opacity = enabled ? '1' : '0.4';
        contrastGroup.style.pointerEvents = enabled ? 'auto' : 'none';
    });
}

async function previewPalette() {
    setBtnLoading(btnPreviewPalette, true, 'Loading…');
    try {
        const res = await authFetch(`${API}/api/preview-palette`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: state.croppedImageUrl,
                set_selections: getSetSelectionsPayload(),
                preprocessing: preprocessingToggle.checked,
                contrast_boost: parseFloat(contrastSlider.value),
            }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Preview failed'); }
        const data = await res.json();
        palettePreview.src = data.url;
        palettePreview.classList.remove('hidden');
        const placeholder = palettePreviewContainer.querySelector('.palette-preview-placeholder');
        if (placeholder) placeholder.style.display = 'none';
    } catch (e) {
        console.error('Preview failed:', e);
        alert('Palette preview failed: ' + e.message);
    } finally {
        setBtnLoading(btnPreviewPalette, false);
    }
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

    try {
        const res = await authFetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: state.croppedImageUrl,
                set_selections: getSetSelectionsPayload(),
                dithering: $('#dithering-toggle').checked,
                preprocessing: preprocessingToggle.checked,
                contrast_boost: parseFloat(contrastSlider.value),
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

        state.mosaicUrl = data.preview_url;
        state.mosaicData = data;

        // Set reference image for comparison
        referenceImage.src = state.croppedImageUrl;

        showTab('build-plan');
        
        // Ensure UI is synced with current data
        if (window.syncQuickConfigUI) window.syncQuickConfigUI();

        renderMosaic();
        renderLegend();
        
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

// ═════════════════════════════════════════════════
//  STEP 4: BUILD PLAN — MOSAIC RENDER
// ═════════════════════════════════════════════════
function renderMosaic() {
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
    state.baseScale = Math.min(1, wrapperWidth / mosaicCanvas.width);
    state.zoom = 1;
    if (typeof mosaicState !== 'undefined') {
        mosaicState.panX = 0;
        mosaicState.panY = 0;
    }
    applyZoom();
}

function applyZoom() {
    const scale = state.baseScale * state.zoom;
    const cw = mosaicCanvas.width * scale;
    const ch = mosaicCanvas.height * scale;
    
    // Scale the canvas via CSS properties directly
    mosaicCanvas.style.width = cw + 'px';
    mosaicCanvas.style.height = ch + 'px';
    
    // Exact match for the comparison slider container so it shrinks naturally
    const wrapper = $('#comparison-wrapper');
    wrapper.style.width = cw + 'px';
    wrapper.style.height = ch + 'px';
    wrapper.style.margin = '0 auto';
    wrapper.style.transform = `translate(${mosaicState.panX}px, ${mosaicState.panY}px)`;

    $('#zoom-label').textContent = `${Math.round(scale * 100)}%`;
}

function renderLegend() {
    const { colors } = state.mosaicData;
    legendItems.innerHTML = '';

    let totalUsed = 0;
    const isFreeMode = colors.some(c => c.count >= 9999);

    colors.forEach((c) => {
        if (c.used === 0 && c.count === 0) return;
        totalUsed += c.used;

        const countLabel = isFreeMode ? `${c.used} used` : `${c.used} / ${c.count} used`;
        const pct = isFreeMode ? 100 : Math.round((c.used / c.count) * 100);

        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color-swatch brick-stud" style="background:${c.hex};box-shadow:0 0 8px ${c.hex}40"></div>
            <div class="flex-1">
                <div class="flex justify-between mb-1">
                    <span class="legend-color-name">${c.name}</span>
                    <span class="legend-color-count">${countLabel}</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-surface-container-highest h-1 rounded-full">
                        <div class="h-full rounded-full" style="width:${pct}%;background:${c.hex};box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 2px rgba(0,0,0,0.3)"></div>
                    </div>
                </div>
            </div>
        `;
        legendItems.appendChild(item);
    });

    const totalLabel = isFreeMode ? `${totalUsed.toLocaleString()} pieces` : `${totalUsed.toLocaleString()} pieces used`;
    totalPieces.textContent = totalLabel;
    legendColorCount.textContent = `${colors.filter(c => c.used > 0).length} colors`;
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

    // Zoom controls
    $('#btn-zoom-in').addEventListener('click', () => {
        state.zoom = Math.min(state.zoom * 1.3, 5);
        applyZoom();
    });
    $('#btn-zoom-out').addEventListener('click', () => {
        state.zoom = Math.max(state.zoom / 1.3, 0.3);
        applyZoom();
    });
    $('#btn-zoom-reset').addEventListener('click', () => {
        state.zoom = 1;
        mosaicState.panX = 0;
        mosaicState.panY = 0;
        applyZoom();
    });

    // Mosaic Canvas interactions (pan / pinch zoom)
    const mw = $('#mosaic-canvas-wrapper');
    mw.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        state.zoom = Math.max(0.3, Math.min(5, state.zoom + delta));
        applyZoom();
    }, { passive: false });

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
        _quickRegenTimer = setTimeout(() => { if (state.croppedImageUrl) generateMosaic(); }, 400);
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
                    }
                    renderSelectedSets();
                    renderQuickChips();
                    scheduleRegen();
                });
            });
            quickSetChips.appendChild(chip);
        });
    }

    function buildQuickAddList(filterText = '') {
        const q = filterText.toLowerCase();
        const allSets = state.allSets;
        quickAddSetList.innerHTML = allSets
            .filter(s => !filterText || s.name.toLowerCase().includes(q) || s.id.includes(q))
            .map(s => {
                const inCart = state.setSelections.some(sel => sel.set.id === s.id);
                return `
                <button class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-surface-container transition-colors w-full ${inCart ? 'text-primary' : 'text-on-surface'}"
                    data-set-id="${s.id}">
                    <span class="material-symbols-outlined" style="font-size:14px">${inCart ? 'check_circle' : 'add_circle'}</span>
                    <span class="flex-1">${s.name}</span>
                    <span class="text-on-surface-variant">#${s.id}</span>
                </button>`;
            }).join('');
        quickAddSetList.querySelectorAll('[data-set-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const setId = btn.dataset.setId;
                const existing = state.setSelections.find(s => s.set.id === setId);
                if (existing) {
                    // Toggle off
                    state.setSelections = state.setSelections.filter(s => s.set.id !== setId);
                } else {
                    const setObj = state.allSets.find(s => s.id === setId);
                    if (setObj) state.setSelections.push({ set: setObj, qty: 1 });
                }
                renderSelectedSets();
                renderQuickChips();
                buildQuickAddList(quickAddSearch.value);
                scheduleRegen();
            });
        });
    }

    // Toggle popover
    quickAddSetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = quickAddPopover.classList.contains('hidden');
        if (isHidden) {
            quickAddPopover.classList.remove('hidden');
            quickAddPopover.style.display = 'flex';
            quickAddSearch.value = '';
            buildQuickAddList();
            quickAddSearch.focus();
        } else {
            quickAddPopover.classList.add('hidden');
            quickAddPopover.style.display = '';
        }
    });
    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!quickAddPopover.contains(e.target) && e.target !== quickAddSetBtn && !quickAddSetBtn.contains(e.target)) {
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
        quickContrastSlider.value = contrastSlider.value;
        quickContrastValue.textContent = parseFloat(contrastSlider.value).toFixed(1);
    }
    window.syncQuickConfigUI = syncQuickConfigUI;
    syncQuickConfigUI();

    quickDitherToggle.addEventListener('change', () => {
        $('#dithering-toggle').checked = quickDitherToggle.checked;
        generateMosaic();
    });
    quickContrastSlider.addEventListener('input', () => {
        contrastSlider.value = quickContrastSlider.value;
        quickContrastValue.textContent = quickContrastSlider.value;
    });
    quickContrastSlider.addEventListener('change', () => {
        generateMosaic();
    });

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
    $('#btn-download').addEventListener('click', downloadMosaic);
    $('#btn-download-instructions').addEventListener('click', downloadInstructions);
    $('#btn-start-over').addEventListener('click', startOver);
    $('#btn-change-set').addEventListener('click', changeSets);
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
        btnComparisonToggle.classList.add('bg-primary/20', 'border-primary/50');
        comparisonDot.classList.add('translate-x-5', '!bg-primary');
    } else {
        referenceLayer.classList.add('hidden');
        comparisonSlider.classList.add('hidden');
        btnComparisonToggle.classList.remove('bg-primary/20', 'border-primary/50');
        comparisonDot.classList.remove('translate-x-5', '!bg-primary');
    }
}

function startOver() {
    state = { setSelections: [], allSets: state.allSets, imageUrl: null, imageWidth: 0, imageHeight: 0, isSquare: false, croppedImageUrl: null, mosaicUrl: null, mosaicData: null, zoom: 1, baseScale: 1, isDev: state.isDev };
    renderSelectedSets();
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

function downloadInstructions() {
    const { grid, colors, width, height } = state.mosaicData;
    const cellSize = 30;
    const headerSize = 20;
    const canvas = document.createElement('canvas');
    canvas.width = width * cellSize + headerSize;
    canvas.height = height * cellSize + headerSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = '8px Inter, sans-serif';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    for (let x = 0; x < width; x++) {
        if (x % 4 === 0) ctx.fillText((x + 1).toString(), headerSize + x * cellSize + cellSize / 2, 14);
    }
    ctx.textAlign = 'right';
    for (let y = 0; y < height; y++) {
        if (y % 4 === 0) ctx.fillText((y + 1).toString(), headerSize - 4, headerSize + y * cellSize + cellSize / 2 + 3);
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ci = grid[y][x];
            const color = colors[ci];
            const cx = headerSize + x * cellSize;
            const cy = headerSize + y * cellSize;
            ctx.fillStyle = color.hex;
            ctx.fillRect(cx, cy, cellSize, cellSize);
            ctx.beginPath();
            ctx.arc(cx + cellSize / 2, cy + cellSize / 2, cellSize / 2 - 3, 0, Math.PI * 2);
            ctx.fillStyle = color.hex;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.fillStyle = isLightColor(color.rgb) ? '#000' : '#fff';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText((ci + 1).toString(), cx + cellSize / 2, cy + cellSize / 2 + 3);
        }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= Math.ceil(width / 16); i++) {
        const lx = headerSize + i * 16 * cellSize;
        ctx.beginPath(); ctx.moveTo(lx, headerSize); ctx.lineTo(lx, canvas.height); ctx.stroke();
    }
    for (let i = 0; i <= Math.ceil(height / 16); i++) {
        const ly = headerSize + i * 16 * cellSize;
        ctx.beginPath(); ctx.moveTo(headerSize, ly); ctx.lineTo(canvas.width, ly); ctx.stroke();
    }

    const link = document.createElement('a');
    link.download = `brickify-build-guide.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
        else btn.textContent = loadingText;
    } else {
        if (textEl) textEl.classList.remove('hidden');
        if (loaderEl) { loaderEl.classList.add('hidden'); loaderEl.style.display = ''; }
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
