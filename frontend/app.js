import { initStore, getState } from './js/store.js';
import { setupAuth } from './js/features/auth.js';
import { setupNavTabs, continueFromSetSelection, showEditorStep } from './js/features/navigation.js';
import { setupSets } from './js/features/sets.js';
import { setupUpload } from './js/features/upload.js';
import { setupCrop } from './js/features/crop.js';
import { setupPreprocessingControls } from './js/features/preprocess.js';
import { setupGenerate } from './js/features/generate.js';
import { setupResult } from './js/features/result.js';
import { setupAdmin } from './js/features/admin.js';
import { openProjectsGallery, closeProjectsGallery, openSaveProjectDialog } from './js/features/project.js';

// Expose functions globally for Alpine and HTML
window.openProjectsGallery = openProjectsGallery;
window.closeProjectsGallery = closeProjectsGallery;
window.saveProject = openSaveProjectDialog;
window.showEditorStep = showEditorStep;

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
    initStore(); // Wire up store.js for extracted modules
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

    setupAuth();
    setupNavTabs();
    setupSets();
    setupUpload();
    setupCrop();
    setupGenerate();
    setupPreprocessingControls();
    setupResult();

    btnContinueSets.addEventListener('click', continueFromSetSelection);
});

