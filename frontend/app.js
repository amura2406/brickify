/**
 * LEGO Mosaic Maker — Frontend Application
 *
 * Handles: set selection, image upload, square cropping,
 * mosaic generation, canvas rendering, export
 */

const API = '';

// ── State ──
let state = {
    setSelections: [],  // [{set, qty}] — multi-set cart
    allSets: [],        // All loaded set details
    imageId: null,
    imageWidth: 0,
    imageHeight: 0,
    isSquare: false,
    croppedImageId: null,
    mosaicId: null,
    mosaicData: null,
    zoom: 1,
};

// ── DOM Refs ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const stepSet = $('#step-set');
const stepUpload = $('#step-upload');
const stepCrop = $('#step-crop');
const stepOptions = $('#step-options');
const stepResult = $('#step-result');
const setsGrid = $('#sets-grid');
const selectedSetsPanel = $('#selected-sets-panel');
const selectedSetsList = $('#selected-sets-list');
const selectedSetsSummary = $('#selected-sets-summary');
const btnContinueSets = $('#btn-continue-sets');
const uploadZone = $('#upload-zone');
const fileInput = $('#file-input');
const cropCanvas = $('#crop-canvas');
const cropOverlay = $('#crop-overlay');
const cropWrapper = $('#crop-wrapper');
const btnApplyCrop = $('#btn-apply-crop');
const btnResetCrop = $('#btn-reset-crop');
const btnGenerate = $('#btn-generate');
const btnPreviewPalette = $('#btn-preview-palette');
const preprocessingToggle = $('#preprocessing-toggle');
const contrastSlider = $('#contrast-slider');
const contrastValue = $('#contrast-value');
const contrastGroup = $('#contrast-group');
const palettePreview = $('#palette-preview');
const palettePreviewContainer = $('#palette-preview-container');
const mosaicCanvas = $('#mosaic-canvas');
const mosaicWrapper = $('#mosaic-canvas-wrapper');
const legendItems = $('#legend-items');
const totalPieces = $('#total-pieces');

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    loadSets();
    setupUpload();
    setupCrop();
    setupGenerate();
    setupPreprocessingControls();
    setupResult();

    btnContinueSets.addEventListener('click', continueFromSetSelection);
});

// ── Step 1: Load & Select Sets ──
async function loadSets() {
    try {
        const res = await fetch(`${API}/api/sets`);
        const data = await res.json();
        renderSets(data.sets);
    } catch (e) {
        console.error('Failed to load sets:', e);
        setsGrid.innerHTML = '<p style="color: var(--text-muted)">Failed to load LEGO sets. Is the server running?</p>';
    }
}

async function renderSets(sets) {
    const details = await Promise.all(
        sets.map(s => fetch(`${API}/api/sets/${s.id}`).then(r => r.json()))
    );

    state.allSets = details;
    setsGrid.innerHTML = '';
    details.forEach((set) => {
        const card = document.createElement('div');
        card.className = 'set-card';
        card.dataset.id = set.id;

        const palette = set.colors.map(c =>
            `<span class="palette-dot" style="background:${c.hex}" title="${c.name}: ${c.count} pcs"></span>`
        ).join('');

        card.innerHTML = `
            <div class="set-card-id">Set ${set.id}</div>
            <div class="set-card-name">${set.name}</div>
            <div class="set-card-desc">${set.description}</div>
            <div class="set-card-meta">
                <span class="meta-chip">${set.grid[0]}×${set.grid[1]} studs</span>
                <span class="meta-chip">${set.colors.length} colors</span>
                <span class="meta-chip">${set.total_studs.toLocaleString()} pcs</span>
            </div>
            <div class="set-card-palette">${palette}</div>
        `;

        card.addEventListener('click', () => addSetToCart(set));
        setsGrid.appendChild(card);
    });
}

function addSetToCart(set) {
    const existing = state.setSelections.find(s => s.set.id === set.id);
    if (existing) {
        existing.qty++;
    } else {
        state.setSelections.push({ set, qty: 1 });
    }
    renderSelectedSets();
}

function removeSetFromCart(setId) {
    state.setSelections = state.setSelections.filter(s => s.set.id !== setId);
    renderSelectedSets();
}

function changeSetQty(setId, delta) {
    const sel = state.setSelections.find(s => s.set.id === setId);
    if (!sel) return;
    sel.qty = Math.max(1, sel.qty + delta);
    renderSelectedSets();
}

function renderSelectedSets() {
    if (state.setSelections.length === 0) {
        selectedSetsPanel.classList.add('hidden');
        $$('.set-card').forEach(c => c.classList.remove('in-cart'));
        return;
    }

    selectedSetsPanel.classList.remove('hidden');

    // Highlight cards in cart
    $$('.set-card').forEach(c => c.classList.remove('in-cart'));
    state.setSelections.forEach(sel => {
        const card = $(`.set-card[data-id="${sel.set.id}"]`);
        if (card) card.classList.add('in-cart');
    });

    // Render list
    selectedSetsList.innerHTML = state.setSelections.map(sel => `
        <div class="selected-set-item">
            <span class="selected-set-name">${sel.set.name}</span>
            <div class="selected-set-controls">
                <button class="qty-btn" data-id="${sel.set.id}" data-delta="-1">−</button>
                <span class="qty-value">${sel.qty}</span>
                <button class="qty-btn" data-id="${sel.set.id}" data-delta="1">+</button>
                <button class="remove-btn" data-id="${sel.set.id}" title="Remove">✕</button>
            </div>
        </div>
    `).join('');

    // Wire up buttons
    selectedSetsList.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            changeSetQty(btn.dataset.id, parseInt(btn.dataset.delta));
        });
    });
    selectedSetsList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSetFromCart(btn.dataset.id);
        });
    });

    // Summary
    const info = getMergedSetInfo();
    selectedSetsSummary.innerHTML = `
        <span>${info.totalColors} unique colors</span>
        <span>•</span>
        <span>${info.totalPieces.toLocaleString()} total pieces</span>
        <span>•</span>
        <span>${info.grid[0]}×${info.grid[1]} grid</span>
    `;

    selectedSetsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

function continueFromSetSelection() {
    if (state.setSelections.length === 0) return;

    clearPalettePreview();
    hideStep(stepResult);

    if (state.croppedImageId) {
        hideStep(stepUpload);
        hideStep(stepCrop);
        showStep(stepOptions);
        updateOptionsPanel();
        stepOptions.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (state.imageId) {
        showStep(state.isSquare ? stepOptions : stepCrop);
        if (state.isSquare) {
            state.croppedImageId = state.imageId;
            updateOptionsPanel();
        }
    } else {
        showStep(stepUpload);
        stepUpload.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function clearPalettePreview() {
    if (palettePreview) {
        palettePreview.style.display = 'none';
        palettePreview.src = '';
    }
    const placeholder = palettePreviewContainer?.querySelector('.palette-preview-placeholder');
    if (placeholder) placeholder.style.display = '';
}

// ── Step 2: Upload ──
function setupUpload() {
    uploadZone.addEventListener('click', () => fileInput.click());

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
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    uploadZone.innerHTML = `
        <div class="upload-icon"><span class="spinner" style="width:32px;height:32px;border-width:3px"></span></div>
        <p class="upload-text">Uploading...</p>
    `;

    try {
        const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();

        state.imageId = data.image_id;
        state.imageWidth = data.width;
        state.imageHeight = data.height;
        state.isSquare = data.is_square;

        if (!data.is_square) {
            showStep(stepCrop);
            hideStep(stepUpload);
            initCropTool();
        } else {
            state.croppedImageId = data.image_id;
            showStep(stepOptions);
            hideStep(stepUpload);
            updateOptionsPanel();
        }
    } catch (e) {
        console.error('Upload failed:', e);
        resetUploadZone();
    }
}

function resetUploadZone() {
    uploadZone.innerHTML = `
        <div class="upload-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
        </div>
        <p class="upload-text">Drag & drop your image here</p>
        <p class="upload-subtext">or click to browse • JPG, PNG, WebP</p>
    `;
}

// ── Step 2b: Crop Tool ──
let cropState = { x: 0, y: 0, size: 0, dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0, displayScale: 1, canvasOffsetX: 0, maxSize: 0 };

const cropZoomSlider = $('#crop-zoom-slider');
const cropZoomValue = $('#crop-zoom-value');

function setupCrop() {
    btnApplyCrop.addEventListener('click', applyCrop);
    btnResetCrop.addEventListener('click', resetCrop);

    // Zoom slider
    cropZoomSlider.addEventListener('input', () => {
        const pct = parseInt(cropZoomSlider.value);
        setCropZoom(pct);
    });

    // Mousewheel zoom on crop area
    cropWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5; // scroll down = zoom out, up = zoom in
        const currentPct = parseInt(cropZoomSlider.value);
        const newPct = Math.max(10, Math.min(100, currentPct - delta)); // inverted: smaller pct = more zoom
        cropZoomSlider.value = newPct;
        setCropZoom(newPct);
    }, { passive: false });
}

function setCropZoom(pct) {
    const maxSize = cropState.maxSize;
    const minSize = Math.max(20, maxSize * 0.1); // Minimum 10% of max
    const newSize = minSize + (maxSize - minSize) * (pct / 100);

    // Keep crop centered on its current center
    const centerX = cropState.x + cropState.size / 2;
    const centerY = cropState.y + cropState.size / 2;

    cropState.size = Math.round(newSize);

    // Recenter
    cropState.x = Math.round(centerX - cropState.size / 2);
    cropState.y = Math.round(centerY - cropState.size / 2);

    // Clamp to canvas bounds
    cropState.x = Math.max(0, Math.min(cropState.x, cropCanvas.width - cropState.size));
    cropState.y = Math.max(0, Math.min(cropState.y, cropCanvas.height - cropState.size));

    updateCropOverlay();
    updateZoomLabel();
}

function updateZoomLabel() {
    // Effective zoom = maxSize / currentSize
    const zoom = cropState.maxSize / cropState.size;
    cropZoomValue.textContent = `${zoom.toFixed(1)}×`;
}

function initCropTool() {
    const ctx = cropCanvas.getContext('2d');
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = `${API}/api/image/${state.imageId}`;
    img.onload = () => {
        // Scale image to fit within container
        const wrapperW = cropWrapper.clientWidth - 2;
        const maxH = 500;
        let scale = Math.min(wrapperW / img.width, maxH / img.height, 1);
        const dispW = Math.round(img.width * scale);
        const dispH = Math.round(img.height * scale);

        cropCanvas.width = dispW;
        cropCanvas.height = dispH;
        ctx.drawImage(img, 0, 0, dispW, dispH);

        cropState.displayScale = scale;

        const canvasOffsetX = Math.max(0, (cropWrapper.clientWidth - dispW) / 2);
        cropState.canvasOffsetX = canvasOffsetX;

        // Init crop square to max centered square
        const minDim = Math.min(dispW, dispH);
        cropState.maxSize = minDim;
        cropState.size = minDim;
        cropState.x = (dispW - minDim) / 2;
        cropState.y = (dispH - minDim) / 2;

        // Reset zoom slider
        cropZoomSlider.value = 100;
        updateCropOverlay();
        updateZoomLabel();

        // Remove old listeners (in case of re-init)
        cropOverlay.removeEventListener('mousedown', startCropDrag);
        cropOverlay.removeEventListener('touchstart', startCropDragTouch);
        document.removeEventListener('mousemove', moveCropDrag);
        document.removeEventListener('touchmove', moveCropDragTouch);
        document.removeEventListener('mouseup', endCropDrag);
        document.removeEventListener('touchend', endCropDrag);

        // Drag handling
        cropOverlay.addEventListener('mousedown', startCropDrag);
        cropOverlay.addEventListener('touchstart', startCropDragTouch, { passive: false });
        document.addEventListener('mousemove', moveCropDrag);
        document.addEventListener('touchmove', moveCropDragTouch, { passive: false });
        document.addEventListener('mouseup', endCropDrag);
        document.addEventListener('touchend', endCropDrag);

        stepCrop.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
}

function updateCropOverlay() {
    const o = cropOverlay;
    o.style.left = cropState.x + 'px';
    o.style.top = cropState.y + 'px';
    o.style.width = cropState.size + 'px';
    o.style.height = cropState.size + 'px';
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
    const dx = e.clientX - cropState.dragStartX;
    const dy = e.clientY - cropState.dragStartY;
    moveCrop(dx, dy);
}

function moveCropDragTouch(e) {
    if (!cropState.dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - cropState.dragStartX;
    const dy = t.clientY - cropState.dragStartY;
    moveCrop(dx, dy);
}

function moveCrop(dx, dy) {
    let nx = cropState.startX + dx;
    let ny = cropState.startY + dy;
    nx = Math.max(0, Math.min(nx, cropCanvas.width - cropState.size));
    ny = Math.max(0, Math.min(ny, cropCanvas.height - cropState.size));
    cropState.x = nx;
    cropState.y = ny;
    updateCropOverlay();
}

function endCropDrag() {
    cropState.dragging = false;
}

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
    // Convert display coords back to image coords
    const scale = cropState.displayScale;
    const x = Math.round(cropState.x / scale);
    const y = Math.round(cropState.y / scale);
    const size = Math.round(cropState.size / scale);

    console.log('Crop request:', { image_id: state.imageId, x, y, size });

    try {
        const res = await fetch(`${API}/api/crop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_id: state.imageId, x, y, size }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('Crop error:', data);
            alert(`Crop failed: ${data.detail || 'Unknown error'}`);
            return;
        }
        state.croppedImageId = data.image_id;
        hideStep(stepCrop);
        showStep(stepOptions);
        updateOptionsPanel();
        stepOptions.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        console.error('Crop failed:', e);
        alert('Crop failed. Please try again.');
    }
}

// ── Step 3: Options & Generate ──
function updateOptionsPanel() {
    const srcImg = $('#source-preview');
    srcImg.src = `${API}/api/image/${state.croppedImageId}`;
    const info = getMergedSetInfo();
    $('#set-name-label').textContent = info.name;
    const [gw, gh] = info.grid;
    $('#grid-size-label').textContent = `${gw}×${gh} studs (${(gw * gh).toLocaleString()} pieces)`;
}

function setupGenerate() {
    btnGenerate.addEventListener('click', generateMosaic);
    btnPreviewPalette.addEventListener('click', previewPalette);
}

function setupPreprocessingControls() {
    // Contrast slider value display
    contrastSlider.addEventListener('input', () => {
        contrastValue.textContent = `${parseFloat(contrastSlider.value).toFixed(1)}×`;
    });

    // Toggle contrast group visibility based on preprocessing toggle
    preprocessingToggle.addEventListener('change', () => {
        contrastGroup.style.opacity = preprocessingToggle.checked ? '1' : '0.4';
        contrastGroup.style.pointerEvents = preprocessingToggle.checked ? 'auto' : 'none';
    });
}

async function previewPalette() {
    const btn = btnPreviewPalette;
    btn.classList.add('loading');
    btn.disabled = true;

    const preprocessing = preprocessingToggle.checked;
    const contrast_boost = parseFloat(contrastSlider.value);

    try {
        const res = await fetch(`${API}/api/preview-palette`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_id: state.croppedImageId,
                set_selections: getSetSelectionsPayload(),
                preprocessing,
                contrast_boost,
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            alert(`Preview failed: ${err.detail || 'Unknown error'}`);
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        palettePreview.src = url;
        palettePreview.style.display = 'block';
        const placeholder = palettePreviewContainer.querySelector('.palette-preview-placeholder');
        if (placeholder) placeholder.style.display = 'none';
    } catch (e) {
        console.error('Preview failed:', e);
        alert('Palette preview failed: ' + e.message);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

async function generateMosaic() {
    const btn = btnGenerate;
    btn.classList.add('loading');
    btn.disabled = true;

    const dithering = $('#dithering-toggle').checked;
    const preprocessing = preprocessingToggle.checked;
    const contrast_boost = parseFloat(contrastSlider.value);

    console.log('Generate request:', { image_id: state.croppedImageId, set_selections: getSetSelectionsPayload(), dithering, preprocessing, contrast_boost });

    try {
        const res = await fetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_id: state.croppedImageId,
                set_selections: getSetSelectionsPayload(),
                dithering,
                preprocessing,
                contrast_boost,
            }),
        });
        const data = await res.json();
        console.log('Generate response status:', res.status, 'mosaic_id:', data.mosaic_id, 'grid:', data.width + 'x' + data.height);

        if (!res.ok) {
            console.error('Generate error:', data);
            alert(`Generation failed: ${data.detail || JSON.stringify(data)}`);
            return;
        }

        state.mosaicId = data.mosaic_id;
        state.mosaicData = data;

        hideStep(stepOptions);
        showStep(stepResult);
        renderMosaic();
        renderLegend();
        stepResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        console.error('Generation failed:', e);
        alert('Mosaic generation failed: ' + e.message);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ── Step 4: Render Result ──
function renderMosaic() {
    const { grid, colors, width, height } = state.mosaicData;
    const studSize = 15;
    const padding = 1;
    const cell = studSize + padding;

    const canvas = mosaicCanvas;
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

            // Draw circular stud
            const centerX = cx + studSize / 2;
            const centerY = cy + studSize / 2;
            const radius = (studSize - 2) / 2;

            // Base color
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = color.hex;
            ctx.fill();

            // Highlight (top-left)
            const hlRadius = radius * 0.35;
            const hlX = centerX - radius * 0.25;
            const hlY = centerY - radius * 0.25;
            const grad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlRadius * 2);
            grad.addColorStop(0, 'rgba(255,255,255,0.3)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Inner circle (stud top)
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    }

    // Set initial zoom to fit the wrapper
    const wrapperWidth = mosaicWrapper.clientWidth - 32; // minus padding
    const canvasWidth = canvas.width;
    state.baseScale = Math.min(1, wrapperWidth / canvasWidth);
    state.zoom = 1;
    applyZoom();
}

function applyZoom() {
    const scale = state.baseScale * state.zoom;
    mosaicCanvas.style.transform = `scale(${scale})`;
    mosaicCanvas.style.transformOrigin = 'top left';
    // Adjust wrapper height to match scaled canvas
    mosaicWrapper.style.height = (mosaicCanvas.height * scale + 32) + 'px';
}

function renderLegend() {
    const { colors } = state.mosaicData;
    legendItems.innerHTML = '';

    let totalUsed = 0;
    let totalAvail = 0;
    const isFreeMode = colors.some(c => c.count >= 9999);

    colors.forEach((c) => {
        if (c.used === 0 && c.count === 0) return;

        totalUsed += c.used;
        totalAvail += c.count;

        const countLabel = isFreeMode ? `${c.used}` : `${c.used} / ${c.count}`;
        const pct = isFreeMode ? 100 : Math.round((c.used / c.count) * 100);
        const item = document.createElement('div');
        item.className = 'legend-item';

        // Skip bar in free mode if color not used
        const barHtml = c.used > 0
            ? `<div class="legend-bar"><div class="legend-bar-fill" style="width:${isFreeMode ? 100 : pct}%;background:${c.hex}"></div></div>`
            : '';

        item.innerHTML = `
            <span class="legend-swatch" style="background:${c.hex}"></span>
            <span class="legend-name">${c.name}</span>
            <span class="legend-count">${countLabel}</span>
            ${barHtml}
        `;
        legendItems.appendChild(item);
    });

    const totalLabel = isFreeMode
        ? `${totalUsed.toLocaleString()} pieces`
        : `${totalUsed.toLocaleString()} / ${totalAvail.toLocaleString()}`;
    totalPieces.innerHTML = `
        <span>Total Pieces Used</span>
        <span>${totalLabel}</span>
    `;
}

function setupResult() {
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

    $('#btn-download').addEventListener('click', downloadMosaic);
    $('#btn-download-instructions').addEventListener('click', downloadInstructions);

    $('#btn-start-over').addEventListener('click', () => {
        state = { selectedSetId: null, selectedSet: null, imageId: null, imageWidth: 0, imageHeight: 0, isSquare: false, croppedImageId: null, mosaicId: null, mosaicData: null, zoom: 1 };
        hideStep(stepResult);
        hideStep(stepOptions);
        hideStep(stepCrop);
        hideStep(stepUpload);
        $$('.set-card').forEach(c => c.classList.remove('selected'));
        resetUploadZone();
        stepSet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#btn-change-set').addEventListener('click', () => {
        hideStep(stepResult);
        hideStep(stepOptions);
        hideStep(stepCrop);
        hideStep(stepUpload);
        $$('.set-card').forEach(c => c.classList.remove('selected'));
        state.selectedSetId = null;
        state.selectedSet = null;
        stepSet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function downloadMosaic() {
    const link = document.createElement('a');
    link.download = `lego-mosaic-${state.selectedSetId}.png`;
    link.href = mosaicCanvas.toDataURL('image/png');
    link.click();
}

function downloadInstructions() {
    const { grid, colors, width, height } = state.mosaicData;

    // Generate a high-res building guide with numbered grid
    const cellSize = 30;
    const headerSize = 20;
    const canvas = document.createElement('canvas');
    const totalW = width * cellSize + headerSize;
    const totalH = height * cellSize + headerSize;
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, totalW, totalH);

    // Column numbers
    ctx.font = '8px Inter, sans-serif';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    for (let x = 0; x < width; x++) {
        if (x % 4 === 0) {
            ctx.fillText((x + 1).toString(), headerSize + x * cellSize + cellSize / 2, 14);
        }
    }

    // Row numbers
    ctx.textAlign = 'right';
    for (let y = 0; y < height; y++) {
        if (y % 4 === 0) {
            ctx.fillText((y + 1).toString(), headerSize - 4, headerSize + y * cellSize + cellSize / 2 + 3);
        }
    }

    // Grid cells
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ci = grid[y][x];
            const color = colors[ci];
            const cx = headerSize + x * cellSize;
            const cy = headerSize + y * cellSize;

            // Cell background
            ctx.fillStyle = color.hex;
            ctx.fillRect(cx, cy, cellSize, cellSize);

            // Circle
            ctx.beginPath();
            ctx.arc(cx + cellSize / 2, cy + cellSize / 2, cellSize / 2 - 3, 0, Math.PI * 2);
            ctx.fillStyle = color.hex;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Color index label
            ctx.fillStyle = isLightColor(color.rgb) ? '#000' : '#fff';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText((ci + 1).toString(), cx + cellSize / 2, cy + cellSize / 2 + 3);
        }
    }

    // Grid lines (every 16 studs for baseplate boundaries)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= Math.ceil(width / 16); i++) {
        const x = headerSize + i * 16 * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, headerSize);
        ctx.lineTo(x, totalH);
        ctx.stroke();
    }
    for (let i = 0; i <= Math.ceil(height / 16); i++) {
        const y = headerSize + i * 16 * cellSize;
        ctx.beginPath();
        ctx.moveTo(headerSize, y);
        ctx.lineTo(totalW, y);
        ctx.stroke();
    }

    const link = document.createElement('a');
    link.download = `lego-building-guide-${state.selectedSetId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function isLightColor(rgb) {
    const [r, g, b] = rgb;
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
}

// ── Helpers ──
function showStep(el) {
    el.classList.remove('hidden');
    el.style.animation = 'none';
    el.offsetHeight; // trigger reflow
    el.style.animation = 'fadeIn 0.5s ease';
}

function hideStep(el) {
    el.classList.add('hidden');
}
