export const initialState = {
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

    contrast_boost: 1.0,
    color_weights: {},  // { "#hexcolor": weight_float }

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
};

let _state = null;

export function initStore() {
    _state = Alpine.store('app');
}

export function getState() {
    if (!_state) {
        // Try to grab the store directly — covers the case where initStore() wasn't called yet
        if (typeof Alpine !== 'undefined' && Alpine.store) {
            const store = Alpine.store('app');
            if (store) {
                console.warn('[Brickify] Store recovered from Alpine.store directly (initStore was not called)');
                _state = store;
                return _state;
            }
        }
        console.warn('[Brickify] Store not initialized yet — returning fallback initialState!');
        return initialState;
    }
    return _state;
}

