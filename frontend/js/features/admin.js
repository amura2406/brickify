import { $, $$ } from '../utils.js';
import { API, authFetch } from '../api.js';

export async function openAdminDashboard() {
    const adminModal = $('#admin-modal');
    if (adminModal) adminModal.classList.remove('hidden');
    await Promise.all([loadPendingUsers(), loadStorageUsage()]);
}

export function setupAdmin() {
    const btnCloseAdmin = $('#btn-close-admin');
    const adminModal = $('#admin-modal');
    if (btnCloseAdmin) {
        btnCloseAdmin.addEventListener('click', () => {
            adminModal?.classList.add('hidden');
        });
    }

    // Expose for inline onclick handlers in HTML
    window.approveUser = async function(uid) {
        if (!confirm("Are you sure you want to approve this user?")) return;
        
        try {
            const res = await authFetch(`${API}/api/admin/approve-user`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({uid})
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Approval failed");
            }
            
            await loadPendingUsers();
        } catch(e) {
            alert("Failed to approve: " + e.message);
        }
    };
}

async function loadPendingUsers() {
    const adminPendingList = $('#admin-pending-list');
    if (!adminPendingList) return;
    
    adminPendingList.innerHTML = `
        <div class="text-center py-8 text-on-surface-variant text-sm font-label flex flex-col items-center gap-3">
          <span class="spinner" style="width:24px;height:24px;border-width:3px;color:#ff2d78"></span>
          Loading pending users...
        </div>
    `;

    try {
        const res = await authFetch(`${API}/api/admin/pending-users`);
        if (!res.ok) throw new Error("Failed to load pending users");
        const data = await res.json();
        const pendingUsers = data.pending || [];
        
        if (pendingUsers.length === 0) {
            adminPendingList.innerHTML = `
                <div class="text-center py-8 text-on-surface-variant text-sm font-label flex flex-col items-center gap-3">
                  <span class="material-symbols-outlined text-4xl opacity-50">check_circle</span>
                  No pending users to approve
                </div>
            `;
            return;
        }

        adminPendingList.innerHTML = pendingUsers.map(u => `
            <div class="flex items-center justify-between p-4 bg-surface-container-high border border-outline-variant rounded-lg">
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-on-surface">${u.email || 'No Email'}</span>
                    <span class="text-[10px] font-label text-on-surface-variant tracking-wider uppercase mt-1">UID: ${u.uid}</span>
                </div>
                <button onclick="approveUser('${u.uid}')" class="px-4 py-2 bg-secondary/10 border border-secondary/50 text-secondary hover:bg-secondary/20 transition-colors rounded font-label text-xs uppercase tracking-wider touch-target shadow-[0_0_10px_rgba(0,255,204,0.1)]">
                    Approve
                </button>
            </div>
        `).join('');

    } catch (e) {
        console.error("Admin error:", e);
        adminPendingList.innerHTML = `
            <div class="text-center py-8 text-error text-sm font-label flex flex-col items-center gap-3">
              <span class="material-symbols-outlined text-4xl opacity-50">error</span>
              Failed to load pending users.<br>${e.message}
            </div>
        `;
    }
}

async function loadStorageUsage() {
    const container = document.getElementById('admin-storage-info');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-4 text-on-surface-variant text-sm font-label flex flex-col items-center gap-3">
          <span class="spinner" style="width:20px;height:20px;border-width:2px;color:#ff2d78"></span>
          Loading usage…
        </div>
    `;

    try {
        const res = await authFetch(`${API}/api/admin/storage-usage`, {
            cache: 'no-store'
        });
        if (!res.ok) throw new Error('Failed to load storage usage');
        const data = await res.json();

        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        };

        const FREE_TIER_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB
        const usagePct = Math.min(100, Math.round((data.total_bytes / FREE_TIER_LIMIT) * 100));
        const isWarning = usagePct > 70;

        let prefixRows = '';
        if (data.by_prefix) {
            prefixRows = Object.entries(data.by_prefix).map(([prefix, info]) => `
                <div class="flex justify-between items-center text-xs">
                    <span class="font-label text-on-surface-variant"><code>${prefix}/</code></span>
                    <span class="font-label text-on-surface">${info.files} files · ${formatBytes(info.bytes)}</span>
                </div>
            `).join('');
        }

        container.innerHTML = `
            <div class="bg-surface-container-high border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
                <div class="flex justify-between items-center">
                    <span class="font-label text-sm text-on-surface font-bold">Total Usage</span>
                    <span class="font-headline font-bold text-lg ${isWarning ? 'text-error' : 'text-secondary'}">${formatBytes(data.total_bytes)}</span>
                </div>
                <div class="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all ${isWarning ? 'bg-error' : 'bg-secondary'}" style="width: ${usagePct}%"></div>
                </div>
                <div class="flex justify-between text-[10px] font-label text-on-surface-variant">
                    <span>${data.total_files} files across all prefixes</span>
                    <span>${usagePct}% of 5 GB free tier</span>
                </div>
                <div class="border-t border-outline-variant/30 pt-2 flex flex-col gap-1">
                    ${prefixRows}
                </div>
            </div>
            <button id="btn-purge-storage" class="w-full mt-1 px-4 py-3 bg-error/10 border border-error/50 text-error hover:bg-error/20 transition-colors rounded-lg font-label text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-sm">delete_sweep</span>
                Purge All Storage (${data.total_files} files)
            </button>
        `;

        const btnPurge = document.getElementById('btn-purge-storage');
        if (btnPurge) {
            btnPurge.addEventListener('click', async () => {
                if (!confirm(`⚠️ This will permanently delete ALL ${data.total_files} stored files. This cannot be undone. Continue?`)) return;
                
                const originalContent = btnPurge.innerHTML;
                btnPurge.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-color:currentcolor;border-bottom-color:transparent"></span> Purging...';
                btnPurge.disabled = true;
                btnPurge.classList.add('opacity-50', 'cursor-not-allowed');

                try {
                    const delRes = await authFetch(`${API}/api/admin/storage-clear`, { method: 'DELETE' });
                    if (!delRes.ok) throw new Error('Failed to start purge');
                    const { job_id } = await delRes.json();

                    const result = await (async () => {
                        for (let i = 0; i < 120; i++) {
                            await new Promise(r => setTimeout(r, 2000));
                            const poll = await authFetch(`${API}/api/admin/storage-clear/${job_id}`);
                            if (!poll.ok) throw new Error('Lost track of purge job');
                            const job = await poll.json();
                            if (job.status === 'done') return job.result;
                            if (job.status === 'error') throw new Error(job.error || 'Purge failed');
                            btnPurge.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;border-color:currentcolor;border-bottom-color:transparent"></span> Purging (${i * 2}s)...`;
                        }
                        throw new Error('Purge timed out waiting for completion');
                    })();
                    
                    container.innerHTML = `<div class="text-center py-4 text-secondary text-sm font-label flex flex-col items-center gap-2">
                        <span class="material-symbols-outlined text-3xl">check_circle</span>
                        Successfully purged ${result.deleted_count} files.
                    </div>`;
                    
                    setTimeout(async () => {
                        await loadStorageUsage();
                    }, 1500);

                } catch (e) {
                    btnPurge.innerHTML = originalContent;
                    btnPurge.disabled = false;
                    btnPurge.classList.remove('opacity-50', 'cursor-not-allowed');
                    alert('Purge failed: ' + e.message);
                }
            });
        }
    } catch (e) {
        console.error('Storage usage error:', e);
        container.innerHTML = `
            <div class="text-center py-4 text-error text-sm font-label">
                Failed to load storage usage: ${e.message}
            </div>
        `;
    }
}
