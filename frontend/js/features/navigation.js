import { $, $$ } from '../utils.js';

let stepIndicators;
let tabPanels;

export function setupNavTabs() {
    stepIndicators = {
        sets: $('#step-sets'),
        editor: $('#step-editor'),
        'build-plan': $('#step-build-plan')
    };
    tabPanels = {
        sets: $('#tab-sets'),
        editor: $('#tab-editor'),
        'build-plan': $('#tab-build-plan')
    };

    const btnBackToSets = $('#btn-back-to-sets');
    const btnBackToEditor = $('#btn-back-to-editor');

    if (btnBackToSets) {
        btnBackToSets.addEventListener('click', () => showTab('sets'));
    }
    if (btnBackToEditor) {
        btnBackToEditor.addEventListener('click', () => showTab('editor'));
    }
}

export function showTab(tabName) {
    if (!stepIndicators || !tabPanels) return;

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

import { getState } from '../store.js';

export function showEditorStep(step) {
    const stepUpload = document.querySelector('#step-upload');
    const stepCrop = document.querySelector('#step-crop');
    
    if (stepUpload) stepUpload.classList.add('hidden');
    if (stepCrop) stepCrop.classList.add('hidden');
    
    if (step === 'upload' && stepUpload) {
        stepUpload.classList.remove('hidden');
    } else if (step === 'crop' && stepCrop) {
        stepCrop.classList.remove('hidden');
    }
}

export function continueFromSetSelection() {
    const state = getState();
    if (!state || state.setSelections.length === 0) return;
    showTab('editor');
    showEditorStep('upload');
}
