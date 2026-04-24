import { $ } from '../utils.js';
import { getState } from '../store.js';
import { API, authFetch } from '../api.js';

let uploadZone, fileInput, btnUploadPath, devFilePath;
let _gphotosAbortController = null;

export function setupUpload() {
    uploadZone = $('#upload-zone');
    fileInput = $('#file-input');
    btnUploadPath = $('#btn-upload-path');
    devFilePath = $('#dev-file-path');
    const btnGPhotos = $('#btn-google-photos');

    if (uploadZone && fileInput) {
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
    }

    // Dev bypass: direct file path
    if (btnUploadPath && devFilePath) {
        btnUploadPath.addEventListener('click', async (e) => {
            e.stopPropagation();
            const path = devFilePath.value.trim();
            if (!path) return;
            await uploadByPath(path);
        });
    }

    // Google Photos Picker button
    if (btnGPhotos) {
        btnGPhotos.addEventListener('click', (e) => {
            e.stopPropagation();
            pickFromGooglePhotos();
        });
    }

    window.handleRecentUploadClick = function handleRecentUploadClick(url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            handleUploadResponse({
                url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                is_square: img.naturalWidth === img.naturalHeight,
            });
        };
        img.onerror = () => handleUploadResponse({ url, width: 1000, height: 1000, is_square: false });
        img.src = url;
    };
}

export async function loadRecentUploads() {
    const state = getState();
    state.recentLoading = true;
    state.recentError = false;
    try {
        const res = await authFetch(`${API}/api/recent-uploads`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        state.recentImages = data.images || [];
        state.recentLoading = false;
    } catch (e) {
        console.error('Recent uploads load failed:', e);
        state.recentImages = [];
        state.recentError = true;
        state.recentLoading = false;
    }
}

async function uploadByPath(filePath) {
    setUploadLoading(true);
    try {
        const res = await authFetch(`${API}/api/upload-path`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload-path failed');
        handleUploadResponse(data);
    } catch (e) {
        console.error('Upload-path failed:', e);
        alert(`Upload failed: ${e.message}`);
    } finally {
        setUploadLoading(false);
    }
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    setUploadLoading(true);
    try {
        const res = await authFetch(`${API}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        handleUploadResponse(data);
    } catch (e) {
        console.error('Upload failed:', e);
        alert(`Upload failed: ${e.message}`);
    } finally {
        setUploadLoading(false);
    }
}

function setUploadLoading(loading) {
    if (!uploadZone) return;
    const uploadContent = uploadZone.querySelector('#upload-main-content');
    if (!uploadContent) return;
    if (loading) {
        uploadContent.innerHTML = `
            <span class="spinner" style="width:40px;height:40px;border-width:3px;color:#ff2d78"></span>
            <p class="font-label text-xs uppercase tracking-widest text-on-surface-variant mt-4">Uploading…</p>
        `;
    } else {
        uploadContent.innerHTML = `
            <span class="material-symbols-outlined text-primary/50 group-hover:text-primary transition-colors" style="font-size: 72px;">cloud_upload</span>
            <div class="text-center">
                <p class="font-headline font-bold text-lg text-on-surface mb-1">Drop your image here</p>
                <p class="font-label text-xs uppercase tracking-widest text-on-surface-variant">or click to browse • JPG, PNG, WebP</p>
            </div>
        `;
    }
}

// ── Google Photos Picker Integration ──────────────────────────────────────────

/**
 * Full Google Photos Picker flow:
 * 1. Get Google OAuth access token (incremental scope)
 * 2. Create Picker session via backend
 * 3. Open picker in popup
 * 4. Poll session until user finishes selection
 * 5. List selected media items
 * 6. Download first image via backend proxy
 * 7. Feed into existing handleUploadResponse()
 */
async function pickFromGooglePhotos() {
    const statusEl = document.getElementById('gphotos-status');
    const statusText = document.getElementById('gphotos-status-text');
    const cancelBtn = document.getElementById('gphotos-cancel');
    const errorEl = document.getElementById('gphotos-error');
    const errorText = document.getElementById('gphotos-error-text');
    const btn = document.getElementById('btn-google-photos');

    // Reset UI
    errorEl?.classList.add('hidden');
    statusEl?.classList.add('hidden');
    cancelBtn?.classList.add('hidden');

    // Abort controller for cancellation
    _gphotosAbortController = new AbortController();
    let pickerWindow = null;
    let pollTimer = null;

    function showStatus(text) {
        statusEl?.classList.remove('hidden');
        if (statusText) statusText.textContent = text;
    }

    function showError(text) {
        statusEl?.classList.add('hidden');
        cancelBtn?.classList.add('hidden');
        errorEl?.classList.remove('hidden');
        if (errorText) errorText.textContent = text;
        btn?.removeAttribute('disabled');
        btn?.classList.remove('opacity-50', 'pointer-events-none');
    }

    function cleanup() {
        if (pollTimer) clearTimeout(pollTimer);
        if (pickerWindow && !pickerWindow.closed) pickerWindow.close();
        statusEl?.classList.add('hidden');
        cancelBtn?.classList.add('hidden');
        btn?.removeAttribute('disabled');
        btn?.classList.remove('opacity-50', 'pointer-events-none');
        _gphotosAbortController = null;
    }

    // Wire cancel button
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            _gphotosAbortController?.abort();
            cleanup();
        };
    }

    // Disable button during flow
    btn?.setAttribute('disabled', 'true');
    btn?.classList.add('opacity-50', 'pointer-events-none');

    try {
        // Step 1: Get Google OAuth access token
        showStatus('Requesting Google Photos access...');
        let accessToken;
        try {
            accessToken = await window.BrickifyAuth.getGooglePhotosAccessToken();
        } catch (authErr) {
            if (authErr.code === 'auth/popup-closed-by-user') {
                cleanup();
                return; // User cancelled — silently abort
            }
            throw authErr;
        }

        if (_gphotosAbortController?.signal.aborted) { cleanup(); return; }

        // Step 2: Create a Picker session
        showStatus('Creating session...');
        const sessionRes = await authFetch(`${API}/api/google-photos/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken }),
        });

        if (!sessionRes.ok) {
            const errData = await sessionRes.json().catch(() => ({}));
            const errMsg = errData.detail || `Session creation failed (${sessionRes.status})`;
            // Check for "no Google Photos" error
            if (sessionRes.status === 412) {
                showError('Your Google account doesn\'t have Google Photos set up. Please use file upload instead.');
                return;
            }
            throw new Error(errMsg);
        }

        const session = await sessionRes.json();
        const sessionId = session.id;
        const pickerUri = session.pickerUri + '/autoclose';

        if (_gphotosAbortController?.signal.aborted) { cleanup(); return; }

        // Step 3: Open picker in popup
        showStatus('Opening Google Photos picker...');
        cancelBtn?.classList.remove('hidden');

        const popupWidth = 600;
        const popupHeight = 700;
        const left = Math.max(0, Math.round(screen.width / 2 - popupWidth / 2));
        const top = Math.max(0, Math.round(screen.height / 2 - popupHeight / 2));
        pickerWindow = window.open(
            pickerUri,
            'googlePhotosPicker',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (!pickerWindow) {
            showError('Popup was blocked. Please allow popups for this site and try again.');
            return;
        }

        // Step 4: Poll session status
        showStatus('Waiting for you to select a photo...');
        let pollInterval = 3000; // default 3 seconds
        let maxPolls = 200; // ~10 min timeout
        let pollCount = 0;

        const pollSession = () => new Promise((resolve, reject) => {
            async function doPoll() {
                if (_gphotosAbortController?.signal.aborted) {
                    reject(new Error('Cancelled'));
                    return;
                }

                pollCount++;
                if (pollCount > maxPolls) {
                    reject(new Error('Session timed out. Please try again.'));
                    return;
                }

                try {
                    const pollRes = await authFetch(
                        `${API}/api/google-photos/session/${sessionId}`,
                        { headers: { 'X-Google-Access-Token': accessToken } }
                    );
                    if (!pollRes.ok) {
                        reject(new Error(`Polling failed (${pollRes.status})`));
                        return;
                    }
                    const pollData = await pollRes.json();

                    if (pollData.mediaItemsSet) {
                        resolve(); // User selected photos!
                        return;
                    }

                    // Use polling config if available
                    if (pollData.pollingConfig?.pollInterval) {
                        const secs = parseFloat(pollData.pollingConfig.pollInterval.replace('s', ''));
                        if (secs > 0) pollInterval = secs * 1000;
                    }
                    if (pollData.pollingConfig?.timeoutIn) {
                        const timeoutSecs = parseFloat(pollData.pollingConfig.timeoutIn.replace('s', ''));
                        if (timeoutSecs <= 0) {
                            reject(new Error('Session timed out. Please try again.'));
                            return;
                        }
                    }

                    // Check if popup is closed AND no selection was made
                    if (pickerWindow && pickerWindow.closed && pollCount > 3) {
                        reject(new Error('Picker was closed without selecting a photo.'));
                        return;
                    }

                    pollTimer = setTimeout(doPoll, pollInterval);
                } catch (e) {
                    reject(e);
                }
            }
            doPoll();
        });

        await pollSession();

        if (_gphotosAbortController?.signal.aborted) { cleanup(); return; }

        // Step 5: List selected media items
        showStatus('Loading selected photo...');
        cancelBtn?.classList.add('hidden');

        const itemsRes = await authFetch(
            `${API}/api/google-photos/session/${sessionId}/media-items`,
            { headers: { 'X-Google-Access-Token': accessToken } }
        );
        if (!itemsRes.ok) throw new Error('Failed to retrieve selected photos');
        const itemsData = await itemsRes.json();
        const items = itemsData.items || [];

        if (items.length === 0) {
            showError('No photos were selected. Please try again.');
            cleanup();
            return;
        }

        // Use the first item
        const firstItem = items[0];
        // Picker API wraps in mediaFile — extract the baseUrl
        const baseUrl = firstItem.mediaFile?.baseUrl || firstItem.baseUrl;
        if (!baseUrl) {
            showError('Could not get photo URL. Please try again.');
            cleanup();
            return;
        }

        // Step 6: Download the photo via backend proxy
        showStatus('Downloading photo...');
        const uploadRes = await authFetch(`${API}/api/google-photos/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken, base_url: baseUrl }),
        });

        if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData.detail || `Failed to download photo (${uploadRes.status})`);
        }

        const uploadData = await uploadRes.json();

        // Step 7: Feed into existing upload flow
        cleanup();
        handleUploadResponse(uploadData);

    } catch (err) {
        console.error('Google Photos flow failed:', err);
        if (err.message === 'Cancelled') {
            cleanup();
            return;
        }
        cleanup();
        showError(err.message || 'An error occurred. Please try again.');
    }
}

function handleUploadResponse(data) {
    const state = getState();
    state.imageUrl = data.url;
    state.imageWidth = data.width;
    state.imageHeight = data.height;
    state.isSquare = data.is_square;

    // Use global functions to proceed until extracted
    if (window.showEditorStep) window.showEditorStep('crop');
    if (window.initCropTool) window.initCropTool();
}
