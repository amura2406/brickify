export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export function setBtnLoading(btn, loading, loadingText = 'Loading…') {
    if (!btn) return;
    const textEl = btn.querySelector('.btn-text');
    const loaderEl = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    if (loading) {
        if (textEl) textEl.classList.add('hidden');
        if (loaderEl) { loaderEl.classList.remove('hidden'); loaderEl.style.display = 'flex'; }
        else {
            if (!btn.hasAttribute('data-original-html')) {
                btn.setAttribute('data-original-html', btn.innerHTML);
            }
            btn.textContent = loadingText;
        }
    } else {
        if (textEl) textEl.classList.remove('hidden');
        if (loaderEl) { loaderEl.classList.add('hidden'); loaderEl.style.display = ''; }
        else if (btn.hasAttribute('data-original-html')) {
            btn.innerHTML = btn.getAttribute('data-original-html');
            btn.removeAttribute('data-original-html');
        }
    }
}
