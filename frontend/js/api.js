import { getState } from './store.js';

export const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : '';

/**
 * Authenticated fetch helper
 * All API calls should use authFetch() instead of bare fetch() in production.
 */
export async function authFetch(url, options = {}) {
    const state = getState();
    if (!state.isDev && window.BrickifyAuth) {
        const token = await window.BrickifyAuth.getIdToken();
        if (token) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return fetch(url, options);
}
