import { $ } from '../utils.js';
import { getState } from '../store.js';
import { API, authFetch } from '../api.js';
import { getPreprocessingParams, applyInstantPreview, hideReferenceLayerImmediately } from './preprocess.js';

let btnGenerate, quickColorModeSelect, gradientConfig, quickGradientConfig;
let quickDitherToggle, gradientColorPickers, quickGradientPickers;
let btnAddGradientColor, btnQuickAddGradientColor, mosaicCanvas;
let historyPeekContainer, historySlider, historySliderLabel;

export function setupGenerate() {
    console.log('[setupGenerate] Initializing generate module ...');
    btnGenerate = $('#btn-generate');
    quickColorModeSelect = $('#quick-color-mode-select');
    gradientConfig = $('#gradient-config');
    quickGradientConfig = $('#quick-gradient-config');
    quickDitherToggle = $('#quick-dither-toggle');
    gradientColorPickers = $('#gradient-color-pickers');
    quickGradientPickers = $('#quick-gradient-color-pickers');
    btnAddGradientColor = $('#btn-add-gradient-color');
    btnQuickAddGradientColor = $('#btn-quick-add-gradient-color');
    mosaicCanvas = $('#mosaic-canvas');
    historyPeekContainer = $('#history-peek-container');
    historySlider = document.getElementById('history-slider');
    historySliderLabel = document.getElementById('history-slider-label');

    console.log('[setupGenerate] DOM elements:', {
        btnGenerate: !!btnGenerate,
        mosaicCanvas: !!mosaicCanvas,
        quickColorModeSelect: !!quickColorModeSelect,
    });

    if (btnGenerate) btnGenerate.addEventListener('click', generateMosaic);

    if (quickColorModeSelect) {
        quickColorModeSelect.addEventListener('change', () => {
            syncColorModeUI();
            if (window.generateMosaic) window.generateMosaic();
        });
    }

    // Wire up handlers referenced by Alpine x-on:change in index.html
    window._onColorModeChange = () => {
        syncColorModeUI();
        if (window.generateMosaic) window.generateMosaic();
    };
    window._onDitheringChange = () => {
        if (window.generateMosaic) window.generateMosaic();
    };

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
        const mode = quickColorModeSelect ? quickColorModeSelect.value : 'realistic';
        
        if (mode === 'gradient') {
            if (gradientConfig) gradientConfig.classList.remove('hidden');
            if (quickGradientConfig) quickGradientConfig.classList.remove('hidden');
        } else {
            if (gradientConfig) gradientConfig.classList.add('hidden');
            if (quickGradientConfig) quickGradientConfig.classList.add('hidden');
        }

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

        document.addEventListener('mousedown', (e) => {
            if (window.activePickerBtn && !popover.contains(e.target) && !window.activePickerBtn.contains(e.target)) {
                popover.classList.add('hidden');
                window.activePickerBtn = null;
            }
        });
        window.colorPopover = popover;
        return popover;
    }

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
        const state = getState();
        const col = state.compareColumns.find(c => c.id === colId);
        if (!col) return;
        
        const availableColors = col.setSelections.length > 0 
            ? col.setSelections.flatMap(s => s.set.colors || []) 
            : [{hex:'000000', name:'Black'}, {hex:'FFFFFF', name:'White'}];
            
        const uniqueColors = Array.from(new Map(availableColors.map(c => [c.hex, c])).values());
        const currentColors = col.gradientColors;
        
        window.showColorPopover(btn, currentColors, uniqueColors, (newHex) => {
            if (window.updateCompareGradient) window.updateCompareGradient(colId, index, newHex);
        });
    }
        
    function setupPickers(btnAdd, container) {
        if (!btnAdd || !container) return;
        
        function openPickerWithContext(btn) {
            const setInfo = window.getMergedSetInfo ? window.getMergedSetInfo() : { colors: [] };
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
            const setInfo = window.getMergedSetInfo ? window.getMergedSetInfo() : { colors: [] };
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

export function getGradientColors(isQuick = false) {
    const container = isQuick ? quickGradientPickers : gradientColorPickers;
    if (!container) return ['#000000', '#ffffff'];
    return Array.from(container.querySelectorAll('button[data-color]')).map(el => el.dataset.color);
}

export async function generateMosaic() {
    console.log('[generateMosaic] START');
    const state = getState();
    console.log('[generateMosaic] state.setSelections:', state.setSelections?.length, 'croppedImageUrl:', !!state.croppedImageUrl);
    
    if (!state.setSelections || state.setSelections.length === 0) {
        console.warn('[generateMosaic] No LEGO sets selected — aborting generation.');
        // Show a visible toast instead of blocking alert()
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-error text-on-error px-6 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in';
        toast.textContent = 'Please select at least one LEGO set before generating a mosaic.';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; }, 3000);
        setTimeout(() => toast.remove(), 3500);
        return;
    }
    
    if (window.setBtnLoading) window.setBtnLoading(btnGenerate, true, 'Processing…');
    const loadingOverlay = document.createElement('div');
    const tabBuildPlan = document.getElementById('tab-build-plan');
    if (tabBuildPlan && tabBuildPlan.style.display !== 'none') {
        loadingOverlay.className = 'absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center';
        loadingOverlay.innerHTML = '<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>';
        const wrapper = document.getElementById('mosaic-canvas-wrapper');
        if (wrapper) wrapper.appendChild(loadingOverlay);
    }

    const isRegeneration = !!state.mosaicData;

    try {
        console.log('[generateMosaic] Preparing request payload ...');
        const isQuickCol = quickColorModeSelect && quickColorModeSelect.value === 'gradient';

        // Timeout wrapper — abort after 60 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        console.log('[generateMosaic] Sending POST to /api/generate ...');
        const res = await authFetch(`${API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: state.croppedImageUrl,
                set_selections: state.setSelections.map(s => ({ set_id: s.set.id, set_name: s.set.name, qty: s.qty })),
                dithering: quickDitherToggle ? quickDitherToggle.checked : false,
                ...getPreprocessingParams(),
                color_mode: quickColorModeSelect ? quickColorModeSelect.value : 'realistic',
                gradient_colors: isQuickCol ? getGradientColors(true) : getGradientColors(),
                target_width: state.targetW || null,
                target_height: state.targetH || null,
                color_weights: state.color_weights && Object.keys(state.color_weights).length > 0 ? state.color_weights : null,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log('[generateMosaic] Response received, status:', res.status);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        console.log('[generateMosaic] Data received, grid:', data.grid?.length, 'x', data.width);

        state.mosaicData = data;
        state.mosaicUrl = renderOffscreenMosaic(data.grid, data.colors, data.width, data.height);

        if (state.historyIndex < state.mosaicHistory.length - 1) {
            state.mosaicHistory = state.mosaicHistory.slice(0, state.historyIndex + 1);
        }
        
        const _getCurrentConfig = window._getCurrentConfig || (() => ({}));
        const _getCurrentCropState = window._getCurrentCropState || (() => ({}));
        state.mosaicHistory.push({
            data: data,
            url: state.mosaicUrl,
            config: _getCurrentConfig(),
            set_selections: JSON.parse(JSON.stringify(state.setSelections)),
            crop_state: _getCurrentCropState()
        });
        if (state.mosaicHistory.length > 6) { 
            state.mosaicHistory.shift();
        }
        state.historyIndex = state.mosaicHistory.length - 1;
        updateHistoryUI(); 

        if (window.showTab) window.showTab('build-plan');
        applyInstantPreview(false); 

        if (window.syncQuickConfigUI) window.syncQuickConfigUI();

        if (window.renderMosaic) window.renderMosaic(isRegeneration);
        if (window.renderLegend) window.renderLegend();
        buildColorWeightsUI();
        hideReferenceLayerImmediately();

        setTimeout(() => {
            const container3d = document.getElementById('3d-canvas-container');
            if (container3d && container3d.style.display !== 'none' && window.update3DMosaic) {
                window.update3DMosaic();
            }
        }, 50);
    } catch (e) {
        if (e.name === 'AbortError') {
            console.error('[generateMosaic] Request timed out after 60s');
            alert('Mosaic generation timed out. Please try again.');
        } else {
            console.error('[generateMosaic] Generation failed:', e);
            alert('Mosaic generation failed: ' + e.message);
        }
    } finally {
        console.log('[generateMosaic] FINALLY — cleaning up');
        if (window.setBtnLoading) window.setBtnLoading(btnGenerate, false);
        if (loadingOverlay.parentNode) loadingOverlay.remove();
    }
}

window.generateMosaic = generateMosaic;

export function renderOffscreenMosaic(grid, colors, width, height) {
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

export function updateHistoryUI() {
    const state = getState();
    if (!historyPeekContainer || !historySlider) return;
    
    const histLen = state.mosaicHistory.length;
    if (histLen <= 1) {
        historyPeekContainer.classList.add('opacity-0', 'pointer-events-none');
        return;
    }
    
    historyPeekContainer.classList.remove('opacity-0', 'pointer-events-none');
    
    const maxBack = Math.min(histLen - 1, 5); 
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
    
    if (slider && label) {
        let isPeeking = false;
        
        slider.addEventListener('input', () => {
            const val = parseInt(slider.value);
            label.textContent = val === 0 ? '0' : val.toString();
            
            if (val === 0) {
                if (isPeeking) {
                    isPeeking = false;
                    if (window.renderMosaic) window.renderMosaic(true); 
                }
                return;
            }
            
            isPeeking = true;
            const idx = state.mosaicHistory.length - 1 + val; 
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
        
        const snapBack = () => {
            slider.value = 0;
            label.textContent = '0';
            if (isPeeking) {
                isPeeking = false;
                if (window.renderMosaic) window.renderMosaic(true); 
            }
        };
        
        slider.addEventListener('mouseup', snapBack, opts);
        slider.addEventListener('touchend', snapBack, opts);
        slider.addEventListener('mouseleave', () => {
            if (isPeeking) snapBack();
        }, opts);
    }
}
window.updateHistoryUI = updateHistoryUI;

// ═════════════════════════════════════════════════
//  COLOR WEIGHTS UI
// ═════════════════════════════════════════════════

function buildColorWeightsUI() {
    const state = getState();
    const container = document.getElementById('color-weight-items');
    const section = document.getElementById('quick-color-weights');
    const btnReset = document.getElementById('btn-reset-weights');
    if (!container || !section) return;
    if (!state.mosaicData || !state.mosaicData.colors) return;

    const colors = state.mosaicData.colors;
    container.innerHTML = '';
    section.classList.remove('hidden');

    // Ensure color_weights is always an object (may be null via Alpine proxy)
    if (!state.color_weights) state.color_weights = {};

    colors.forEach((c) => {
        const hex = c.hex.toLowerCase();
        const currentWeight = state.color_weights[hex];
        const isExcluded = currentWeight === 0;
        const weight = (currentWeight !== undefined && currentWeight > 0) ? currentWeight : 1.0;

        const item = document.createElement('div');
        item.className = 'cw-item';
        item.innerHTML = `
            <div class="cw-row">
                <div class="cw-swatch" style="background:${c.hex}"></div>
                <span class="cw-name" title="${c.name}">${c.name}</span>
                <label class="cw-toggle">
                    <input type="checkbox" ${isExcluded ? '' : 'checked'} data-hex="${hex}" class="cw-checkbox" />
                    <span class="cw-toggle-track"><span class="cw-toggle-thumb"></span></span>
                </label>
            </div>
            <div class="cw-slider-row ${isExcluded ? 'hidden' : ''}">
                <input type="range" min="0.1" max="3.0" step="0.1" value="${weight}" class="cw-slider" data-hex="${hex}" />
                <span class="cw-val">${weight.toFixed(1)}×</span>
            </div>
        `;

        const checkbox = item.querySelector('.cw-checkbox');
        const sliderRow = item.querySelector('.cw-slider-row');
        const slider = item.querySelector('.cw-slider');
        const valLabel = item.querySelector('.cw-val');

        checkbox.addEventListener('change', () => {
            if (!checkbox.checked) {
                state.color_weights[hex] = 0;
                sliderRow.classList.add('hidden');
            } else {
                const sv = parseFloat(slider.value) || 1.0;
                state.color_weights[hex] = sv;
                sliderRow.classList.remove('hidden');
            }
            // Regenerate with new weights
            if (window.generateMosaic) window.generateMosaic();
        });

        // Live label update while dragging
        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            valLabel.textContent = v.toFixed(1) + '×';
            state.color_weights[hex] = v;
        });

        // Trigger regeneration on release
        slider.addEventListener('change', () => {
            const v = parseFloat(slider.value);
            state.color_weights[hex] = v;
            if (window.generateMosaic) window.generateMosaic();
        });

        container.appendChild(item);
    });

    if (btnReset) {
        btnReset.onclick = () => {
            state.color_weights = {};
            buildColorWeightsUI();
            if (window.generateMosaic) window.generateMosaic();
        };
    }
}

window.buildColorWeightsUI = buildColorWeightsUI;
