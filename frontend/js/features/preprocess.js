import { $, $$ } from '../utils.js';
import { getState } from '../store.js';

let previewDebounceMs = 50;
let previewTimeoutId = null;
let btnToggleAdvancedAdjustments, advancedAdjustments, btnQuickToggleAdvanced, quickAdvancedAdjustments;
let referenceLayer, comparisonSlider;

export function setupPreprocessingControls() {
    btnToggleAdvancedAdjustments = $('#btn-toggle-advanced-adjustments');
    advancedAdjustments = $('#advanced-adjustments');
    btnQuickToggleAdvanced = $('#btn-quick-toggle-advanced');
    quickAdvancedAdjustments = $('#quick-advanced-adjustments');
    referenceLayer = $('#reference-layer');
    comparisonSlider = $('#comparison-slider');

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

export function getPreprocessingParams() {
    const state = getState();
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

export function applyInstantPreview(isManualInteraction = false) {
    const state = getState();
    clearTimeout(previewTimeoutId);
    previewTimeoutId = setTimeout(() => {
        const srcImg = $('#source-preview');
        if (!state.croppedImageUrl) return;

        const isQuick = $('#tab-build-plan').style.display !== 'none';
        const p = getPreprocessingParams();
        
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
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
            
            const lut = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                lut[i] = 255 * Math.pow(Math.max(0, Math.min(1, (i - bp) / range)), invGamma);
            }

            for (let i = 0; i < d.length; i += 4) {
                let r = d[i], g = d[i+1], b = d[i+2];
                r = lut[r];
                g = lut[g];
                b = lut[b];
                r = contrast * (r - 128) + 128;
                g = contrast * (g - 128) + 128;
                b = contrast * (b - 128) + 128;
                r += tempVal;
                b -= tempVal;
                const lum = 0.299*r + 0.587*g + 0.114*b;
                r = lum + satFactor * (r - lum);
                g = lum + satFactor * (g - lum);
                b = lum + satFactor * (b - lum);
                d[i] = Math.max(0, Math.min(255, r));
                d[i+1] = Math.max(0, Math.min(255, g));
                d[i+2] = Math.max(0, Math.min(255, b));
            }

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

            if (!isQuick && srcImg) {
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
                                refLayer.style.clipPath = 'inset(0 0 0 0)';
                                refLayer.style.opacity = '1';
                            }
                        }
                    };
                    tempImg.src = dataUrl;
                }
            }
        };
        img.onerror = () => {
            // CORS failed — fall back to showing the raw image without preprocessing
            console.warn('[applyInstantPreview] CORS image load failed, falling back to raw URL');
            if (isQuick) {
                const refImg = $('#reference-image');
                if (refImg) {
                    refImg.src = state.croppedImageUrl;
                }
            }
        };
        img.src = state.croppedImageUrl;
    }, previewDebounceMs);
}

export function hideReferenceLayerImmediately() {
    if (typeof referenceLayer !== 'undefined' && referenceLayer) {
        if (!window.isComparisonActive) {
            referenceLayer.classList.add('hidden');
        } else {
            if (typeof comparisonSlider !== 'undefined' && comparisonSlider) {
                referenceLayer.style.clipPath = `inset(0 ${100 - comparisonSlider.value}% 0 0)`;
            }
        }
    }
}

window._onSliderInput = () => {
    applyInstantPreview(true);
};

window.hideReferenceLayerImmediately = hideReferenceLayerImmediately;

window._onSliderChange = () => {
    hideReferenceLayerImmediately();
    if (window.generateMosaic) window.generateMosaic();
};
