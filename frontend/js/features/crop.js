import { $ } from '../utils.js';
import { getState } from '../store.js';
import { API, authFetch } from '../api.js';

let btnApplyCrop, btnResetCrop, cropWrapper, btnRotateImage;
let cropZoomValue, targetResolutionSelect, btnRotateCrop;
let cropCanvas, cropOverlay;

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

export function setupCrop() {
    btnApplyCrop = $('#btn-apply-crop');
    btnResetCrop = $('#btn-reset-crop');
    cropWrapper = $('#crop-wrapper');
    btnRotateImage = $('#btn-rotate-image');
    cropZoomValue = $('#crop-zoom-value');
    targetResolutionSelect = $('#target-resolution-select');
    btnRotateCrop = $('#btn-rotate-crop');
    cropCanvas = $('#crop-canvas');
    cropOverlay = $('#crop-overlay');

    if (btnApplyCrop) btnApplyCrop.addEventListener('click', applyCrop);
    if (btnResetCrop) btnResetCrop.addEventListener('click', resetCrop);

    if (cropWrapper) {
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
    }

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
    if (cropZoomValue) {
        cropZoomValue.textContent = `${cropState.imgScale.toFixed(1)}×`;
    }
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
    const state = getState();
    const info = window.getMergedSetInfo ? window.getMergedSetInfo() : { grid: [48, 48], totalPieces: 2304 };
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
    if (!cropCanvas) return;
    
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

export function initCropTool() {
    const state = getState();
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

            if (cropWrapper && cropCanvas) {
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
            }

            // We can just use displayScale = 1, as imgScale will automatically adjust to 
            // fill the crop frame perfectly in recalcCropFrame().
            cropState.displayScale = 1;
            // Store the loaded image for redraws
            cropState._img = img;

            populateTargetResolutions();
            recalcCropFrame();

            if (cropOverlay) {
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
            }
        });
    };
}

function drawCropScene() {
    if (!cropCanvas) return;
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
    if (cropOverlay) {
        cropOverlay.style.left = cropState.frameX + 'px';
        cropOverlay.style.top = cropState.frameY + 'px';
        cropOverlay.style.width = cropState.frameW + 'px';
        cropOverlay.style.height = cropState.frameH + 'px';
    }
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
    const state = getState();
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

    if (window.setBtnLoading) window.setBtnLoading(btnApplyCrop, true, 'Cropping…');
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
        if (window.updateHistoryUI) window.updateHistoryUI(); // Clear UI dots
        
        if (window.showTab) window.showTab('build-plan');
        if (window.generateMosaic) window.generateMosaic();
    } catch (e) {
        console.error('Crop failed:', e);
        alert(`Crop failed: ${e.message}`);
    } finally {
        if (window.setBtnLoading) window.setBtnLoading(btnApplyCrop, false);
    }
}
