/**
 * Brickify — Firebase Auth Module
 *
 * Handles Google Sign-In, token management, and the local auth state.
 * Exports:
 *   - initFirebaseAuth(onReady, onPendingApproval, onSignOut)
 *   - getIdToken()         → Promise<string|null>  (refreshes if needed)
 *   - signOut()
 */

// Lazy init — the SDK scripts must already be loaded by index.html
let _app, _auth, _googleProvider;
let _initPromise;

async function _ensureInit() {
    if (_auth) return;

    // Provide a single promise to prevent race conditions connecting multiple times concurrently
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        if (!window.firebase) {
            throw new Error("Firebase SDK not loaded. Add SDKs to index.html.");
        }
        if (!firebase.apps.length) {
            const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? 'http://localhost:8000' 
                : '';
            const res = await fetch(`${API}/api/firebase-config`);
            if (!res.ok) throw new Error("Failed to load Firebase config from backend");
            const config = await res.json();
            _app = firebase.initializeApp(config);
        } else {
            _app = firebase.apps[0];
        }
        _auth = firebase.auth();
        _googleProvider = new firebase.auth.GoogleAuthProvider();
    })();

    await _initPromise;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the auth flow.
 *
 * @param {Function} onReady          - called with user object when authenticated + approved
 * @param {Function} onPendingApproval - called with user object when authenticated but not approved
 * @param {Function} onSignOut        - called when user is signed out
 */
async function initFirebaseAuth(onReady, onPendingApproval, onSignOut) {
    await _ensureInit();

    _auth.onAuthStateChanged(async (user) => {
        if (!user) {
            onSignOut();
            return;
        }

        // Force-refresh to get latest custom claims
        const tokenResult = await user.getIdTokenResult(/* forceRefresh */ true);
        const claims = tokenResult.claims;
        const isAdmin = (user.email || "").toLowerCase() === "amuhr4@gmail.com";
        const isApproved = isAdmin || !!claims.approved;

        if (isApproved) {
            onReady(user);
        } else {
            onPendingApproval(user);
        }
    });
}

/**
 * Open the Google sign-in popup.
 * @returns {Promise<void>}
 */
async function signInWithGoogle() {
    await _ensureInit();
    await _auth.signInWithPopup(_googleProvider);
    // onAuthStateChanged will handle the result
}

/**
 * Get a fresh Firebase ID token (auto-refreshes if expired).
 * Returns null if not signed in.
 * @returns {Promise<string|null>}
 */
async function getIdToken() {
    await _ensureInit();
    const user = _auth.currentUser;
    if (!user) return null;
    return user.getIdToken(/* forceRefresh */ false);
}

/**
 * Sign the current user out.
 */
async function signOut() {
    await _ensureInit();
    await _auth.signOut();
}

// Expose on window so app.js can use without import()
window.BrickifyAuth = { initFirebaseAuth, signInWithGoogle, getIdToken, signOut };
