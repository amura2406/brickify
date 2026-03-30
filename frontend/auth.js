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

function isBypassMode() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
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
    if (isBypassMode()) {
        console.warn("🔐 Local mode detected. Bypassing Firebase Auth.");
        setTimeout(() => {
            onReady({
                uid: "local-dev-user",
                email: "admin@local.test",
                displayName: "Local Dev",
                photoURL: "https://lh3.googleusercontent.com/a/default-user",
                isAdmin: true
            });
        }, 100);
        return;
    }

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

        user.isAdmin = isAdmin;

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
    if (isBypassMode()) {
        console.warn("signInWithGoogle ignored in local dev mode.");
        return;
    }
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
    if (isBypassMode()) return "mock-dev-token";
    await _ensureInit();
    const user = _auth.currentUser;
    if (!user) return null;
    return user.getIdToken(/* forceRefresh */ false);
}

/**
 * Sign the current user out.
 */
async function signOut() {
    if (isBypassMode()) {
        console.warn("signOut ignored in local dev mode.");
        window.location.reload();
        return;
    }
    await _ensureInit();
    await _auth.signOut();
}

// ── Google Photos incremental scope authorization ────────────────────────────

/**
 * Cached Google OAuth access token for the Picker API.
 * @type {{ token: string, expiresAt: number } | null}
 */
let _gphotosToken = null;

/**
 * Request a Google OAuth access token with the `photospicker.mediaitems.readonly`
 * scope via incremental authorization. This opens a popup asking for additional
 * permissions beyond the base Google Sign-In.
 *
 * The token is cached for 50 minutes (the Picker API baseUrl validity is 60 min).
 *
 * @returns {Promise<string>} The Google OAuth2 access token.
 * @throws {Error} If not signed in or authorization is denied.
 */
async function getGooglePhotosAccessToken() {
    if (isBypassMode()) {
        throw new Error("Google Photos is not available in local dev mode.");
    }

    // Return cached token if still valid
    if (_gphotosToken && Date.now() < _gphotosToken.expiresAt) {
        return _gphotosToken.token;
    }

    await _ensureInit();

    const user = _auth.currentUser;
    if (!user) {
        throw new Error("Not signed in. Please sign in first.");
    }

    // Create a new provider with the Photos Picker scope
    const pickerProvider = new firebase.auth.GoogleAuthProvider();
    pickerProvider.addScope("https://www.googleapis.com/auth/photospicker.mediaitems.readonly");

    // Use signInWithPopup to do incremental authorization.
    // This will show a consent screen for the new scope only.
    const result = await _auth.signInWithPopup(pickerProvider);

    const credential = result.credential;
    if (!credential || !credential.accessToken) {
        throw new Error("Failed to obtain Google access token. Please try again.");
    }

    // Cache for 50 minutes (Picker API tokens are valid for 60 min)
    _gphotosToken = {
        token: credential.accessToken,
        expiresAt: Date.now() + (50 * 60 * 1000),
    };

    return _gphotosToken.token;
}

// Expose on window so app.js can use without import()
window.BrickifyAuth = { initFirebaseAuth, signInWithGoogle, getIdToken, signOut, getGooglePhotosAccessToken };
