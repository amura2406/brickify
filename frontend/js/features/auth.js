import { $, $$ } from '../utils.js';
import { getState } from '../store.js';
import { showTab } from './navigation.js';
import { loadRecentUploads } from './upload.js';
import { openAdminDashboard } from './admin.js';
import { openProjectsGallery } from './project.js';

export function setupAuth() {
    const state = getState();
    const loginScreen = $('#login-screen');
    const pendingScreen = $('#pending-screen');
    const appContainer = $('#app-container');
    const btnLoginGoogle = $('#btn-login-google');
    const devBypassNotice = $('#dev-bypass-notice');
    const devPathUpload = $('#dev-path-upload');
    const pendingUserEmail = $('#pending-user-email');
    const btnPendingSignOut = $('#btn-pending-signout');

    function _showOnly(screen) {
        loginScreen?.classList.add('hidden');
        pendingScreen?.classList.add('hidden');
        appContainer?.classList.add('hidden');
        if (screen === 'login') loginScreen?.classList.remove('hidden');
        if (screen === 'pending') pendingScreen?.classList.remove('hidden');
        if (screen === 'app') appContainer?.classList.remove('hidden');
    }

    function _setNavUser(user) {
        const avatar = $('#nav-user-avatar');
        const name = $('#nav-user-name');
        const email = $('#nav-user-email');
        if (!user) return;
        const initials = (user.displayName || user.email || '?').slice(0, 2).toUpperCase();
        if (user.photoURL && avatar) {
            avatar.innerHTML = `<img src="${user.photoURL}" class="w-full h-full object-cover" alt="avatar">`;
        } else if (avatar) {
            avatar.textContent = initials;
        }
        if (name) name.textContent = user.displayName || '';
        if (email) email.textContent = user.email || '';

        const btnNavAdmin = $('#btn-nav-admin');
        if (btnNavAdmin) {
            if (user.isAdmin) {
                btnNavAdmin.classList.remove('hidden');
                btnNavAdmin.classList.add('flex');
            } else {
                btnNavAdmin.classList.add('hidden');
                btnNavAdmin.classList.remove('flex');
            }
        }
    }

    function _setupUserMenu() {
        const menuBtn = $('#btn-user-menu');
        const menuDropdown = $('#user-menu-dropdown');
        const signOutBtn = $('#btn-nav-signout');
        const adminBtn = $('#btn-nav-admin');
        const projectsBtn = $('#btn-nav-projects');

        menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown?.classList.toggle('hidden');
        });
        document.addEventListener('click', () => menuDropdown?.classList.add('hidden'));
        signOutBtn?.addEventListener('click', () => window.BrickifyAuth.signOut());
        btnPendingSignOut?.addEventListener('click', () => window.BrickifyAuth.signOut());
        
        adminBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown?.classList.add('hidden');
            openAdminDashboard();
        });

        projectsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown?.classList.add('hidden');
            if (typeof openProjectsGallery === 'function') openProjectsGallery();
        });
    }

    function showApp() {
        appContainer?.classList.remove('hidden');
        showTab('sets');
        loadRecentUploads();
        const gphotosSection = document.getElementById('google-photos-section');
        if (gphotosSection && !state.isDev) {
            gphotosSection.classList.remove('hidden');
        }
    }

    // Init Flow
    const params = new URLSearchParams(window.location.search);
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const bypass = isLocalhost && params.get('bypass_login') === 'true';
    state.isDev = bypass;

    if (bypass) {
        _showOnly('app');
        devBypassNotice?.classList.remove('hidden');
        devPathUpload?.classList.remove('hidden');
        _setupUserMenu();
        showApp();
        return;
    }

    _showOnly('login');
    _setupUserMenu();

    btnLoginGoogle?.addEventListener('click', async () => {
        try {
            btnLoginGoogle.disabled = true;
            btnLoginGoogle.textContent = 'Signing in…';
            await window.BrickifyAuth.signInWithGoogle();
        } catch (err) {
            console.error('Sign-in error:', err);
            btnLoginGoogle.disabled = false;
            btnLoginGoogle.innerHTML = `
                <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google`;
        }
    });

    if (window.BrickifyAuth) {
        window.BrickifyAuth.initFirebaseAuth(
            (user) => { _setNavUser(user); _showOnly('app'); showApp(); },
            (user) => { if (pendingUserEmail) pendingUserEmail.textContent = user.email || ''; _showOnly('pending'); },
            () => { _showOnly('login'); }
        );
    }
}
