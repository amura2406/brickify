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
    imageId: null,
    imageWidth: 0,
    imageHeight: 0,
    isSquare: false,
    croppedImageId: null,
    mosaicId: null,
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
const navTabs = $$('.nav-tab');
const tabPanels = { sets: $('#tab-sets'), editor: $('#tab-editor'), 'build-plan': $('#tab-build-plan') };

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
//  bypass_login=true: always bypass (dev + you)
//  Normal: show login, sign-in dismisses it
// ═════════════════════════════════════════════════
function initAppFlow() {
    const params = new URLSearchParams(window.location.search);
    const bypass = params.get('bypass_login') === 'true';
    state.isDev = bypass;

    if (bypass) {
        loginScreen.classList.add('hidden');
        showApp();
        devBypassNotice.classList.remove('hidden');
        devPathUpload.classList.remove('hidden');
    } else {
        // Normal login: show screen, sign-in via Google (Firebase SSO)
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');

        btnLoginGoogle.addEventListener('click', () => {
            // TODO: Replace with firebase.auth().signInWithPopup(googleProvider)
            loginScreen.classList.add('hidden');
            showApp();
        });
    }
}

function showApp() {
    appContainer.classList.remove('hidden');
    showTab('sets');
}

// ═════════════════════════════════════════════════
//  TAB NAVIGATION
// ═════════════════════════════════════════════════
function setupNavTabs() {
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });
}

function showTab(tabName) {
    // Update tab buttons
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

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
        const res = await fetch(`${API}/api/upload-path`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload-path failed');
        handleUploadResponse(data);
    } catch (e) {
        console.error('Upload-path failed:', e);
        setUploadLoading(false);
        alert(`Upload failed: ${e.message}`);
    }
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    setUploadLoading(true);
    try {
        const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        handleUploadResponse(data);
    } catch (e) {
        console.error('Upload failed:', e);
        setUploadLoading(false);
        alert(`Upload failed: ${e.message}`);
    }
}

function setUploadLoading(loading) {
    const uploadContent = uploadZone.querySelector('.upload-main-content');
    if (!uploadContent) return;
    if (loading) {
        uploadContent.innerHTML = `
            <span class="spinner" style="width:40px;height:40px;border-width:3px;color:#ff2d78"></span>
            <p class="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-4">Uploading…</p>
        `;
    }
}

function handleUploadResponse(data) {
    state.imageId = data.image_id;
    state.imageWidth = data.width;
    state.imageHeight = data.height;
    state.isSquare = data.is_square;

    if (!data.is_square) {
        showEditorStep('crop');
        initCropTool();
    } else {
        state.croppedImageId = data.image_id;
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
    img.crossOrigin = 'anonymous';
    img.src = `${API}/api/image/${state.imageId}`;
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
        const res = await fetch(`${API}/api/crop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_id: state.imageId, x, y, size }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Crop failed');
        state.croppedImageId = data.image_id;
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
    if (srcImg && state.croppedImageId) {
        srcImg.src = `${API}/api/image/${state.croppedImageId}`;
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
        const res = await fetch(`${API}/api/preview-palette`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_id: state.croppedImageId,
                set_selections: getSetSelectionsPayload(),
                preprocessing: preprocessingToggle.checked,
                contrast_boost: parseFloat(contrastSlider.value),
            }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Preview failed'); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        palettePreview.src = url;
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
    setBtnLoading(btnGenerate, true, 'Processing…');
    try {
        const res = await fetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_id: state.croppedImageId,
                set_selections: getSetSelectionsPayload(),
                dithering: $('#dithering-toggle').checked,
                preprocessing: preprocessingToggle.checked,
                contrast_boost: parseFloat(contrastSlider.value),
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));

        state.mosaicId = data.mosaic_id;
        state.mosaicData = data;

        // Set reference image for comparison
        referenceImage.src = `${API}/api/image/${state.croppedImageId}`;

        showTab('build-plan');
        renderMosaic();
        renderLegend();
    } catch (e) {
        console.error('Generation failed:', e);
        alert('Mosaic generation failed: ' + e.message);
    } finally {
        setBtnLoading(btnGenerate, false);
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
    applyZoom();
}

function applyZoom() {
    const scale = state.baseScale * state.zoom;
    mosaicCanvas.style.transform = `scale(${scale})`;
    mosaicCanvas.style.transformOrigin = 'top left';
    mosaicWrapper.style.height = (mosaicCanvas.height * scale + 32) + 'px';
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

        const countLabel = isFreeMode ? `${c.used} pcs` : `${c.used} / ${c.count} pcs`;
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
                        <div class="h-full rounded-full" style="width:${pct}%;background:${c.hex}"></div>
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
        applyZoom();
    });

    // 2D / 3D toggle
    btn2d.addEventListener('click', () => {
        if (isComparisonActive) toggleComparison();
        mosaicWrapper.classList.remove('mosaic-3d-perspective');
        btn2d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all bg-primary text-on-primary shadow-[0_0_10px_rgba(255,45,120,0.4)]';
        btn3d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all text-on-surface-variant hover:text-on-surface';
    });
    btn3d.addEventListener('click', () => {
        if (isComparisonActive) toggleComparison();
        mosaicWrapper.classList.add('mosaic-3d-perspective');
        btn3d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all bg-primary text-on-primary shadow-[0_0_10px_rgba(255,45,120,0.4)]';
        btn2d.className = 'px-3 py-1 text-xs font-label uppercase tracking-wider rounded-lg transition-all text-on-surface-variant hover:text-on-surface';
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
    state = { setSelections: [], allSets: state.allSets, imageId: null, imageWidth: 0, imageHeight: 0, isSquare: false, croppedImageId: null, mosaicId: null, mosaicData: null, zoom: 1, baseScale: 1, isDev: state.isDev };
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
