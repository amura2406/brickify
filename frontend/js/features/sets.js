import { $, $$ } from '../utils.js';
import { getState } from '../store.js';
import { API } from '../api.js';
import { showTab } from './navigation.js';
// We'll import showEditorStep from app.js for now or define a callback

let setSearch;

export function setupSets(onContinueToEditor) {
    setSearch = $('#set-search');
    
    // Assign Alpine helpers to window
    window.setCardToggle = setCardToggle;
    window.setCardQtyChange = setCardQtyChange;
    window.getMergedSetInfoFromCart = getMergedSetInfoFromCart;

    setupSearch();

    const btnContinueSets = $('#btn-continue-sets');
    if (btnContinueSets) {
        btnContinueSets.addEventListener('click', () => {
            const state = getState();
            if (state.setSelections.length === 0) return;
            showTab('editor');
            if (onContinueToEditor) onContinueToEditor('upload');
        });
    }

    // Return the initialization promise
    return loadSets();
}

export async function loadSets() {
    const state = getState();
    try {
        const res = await fetch(`${API}/api/sets`);
        const data = await res.json();
        await renderSets(data.sets);
    } catch (e) {
        console.error('Failed to load sets:', e);
        state.allSets = [];
        state.setsLoading = false;
    }
}

export async function renderSets(sets) {
    const state = getState();
    state.allSets = sets.filter(Boolean);
    state.setsLoading = false;
}

export function createSetCard(set) {
    const state = getState();
    const card = document.createElement('div');
    card.className = 'set-card';
    card.dataset.id = set.id;

    const palette = (set.colors ? set.colors.slice(0, 10) : []).map(c =>
        `<span class="palette-dot" style="background:${c.hex}" title="${c.name.replace(/"/g, '&quot;')}: ${c.count} pcs"></span>`
    ).join('');

    const totalPiecesCount = set.colors ? set.colors.reduce((s, c) => s + c.count, 0) : 0;

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
                    ${set.colors ? set.colors.length : 0} colors
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

    card.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const qtyEl = card.querySelector('.qty-value');
            const current = parseInt(qtyEl.textContent);
            const newQty = action === 'inc' ? current + 1 : Math.max(1, current - 1);
            qtyEl.textContent = newQty;
            const sel = state.setSelections.find(s => s.set.id === set.id);
            if (sel) {
                sel.qty = newQty;
                renderSelectedSets();
            }
        });
    });

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

export function addSetToCart(set, qty = 1) {
    const state = getState();
    const existing = state.setSelections.find(s => s.set.id === set.id);
    if (existing) {
        existing.qty = qty;
    } else {
        state.setSelections.push({ set, qty });
    }
    renderSelectedSets();
}

export function removeSetFromCart(setId) {
    const state = getState();
    state.setSelections = state.setSelections.filter(s => s.set.id !== setId);
    renderSelectedSets();
}

export function renderSelectedSets() {
    // No-op for Alpine
}

export function getMergedSetInfo() {
    const state = getState();
    const colorMap = {};
    let maxGw = 0, maxGh = 0;
    const names = [];

    state.setSelections.forEach(sel => {
        const [gw, gh] = sel.set.grid;
        if (gw * gh > maxGw * maxGh) { maxGw = gw; maxGh = gh; }
        names.push(sel.qty > 1 ? `${sel.set.name} ×${sel.qty}` : sel.set.name);
        (sel.set.colors || []).forEach(c => {
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

export function getMergedSetInfoFromCart(cart) {
    const colorMap = {};
    let maxGw = 0, maxGh = 0;

    (cart || []).forEach(sel => {
        const [gw, gh] = sel.set.grid;
        if (gw * gh > maxGw * maxGh) { maxGw = gw; maxGh = gh; }
        (sel.set.colors || []).forEach(c => {
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

export function setCardToggle(setId, cardEl) {
    const state = getState();
    const existing = state.setSelections.find(s => s.set.id === setId);
    if (existing) {
        removeSetFromCart(setId);
    } else {
        const qtyEl = cardEl?.querySelector('.qty-value');
        const qty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;
        const set = state.allSets.find(s => s.id === setId);
        if (set) addSetToCart(set, qty);
    }
}

export function setCardQtyChange(setId, delta, cardEl) {
    const state = getState();
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
}

export function setupSearch() {
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
