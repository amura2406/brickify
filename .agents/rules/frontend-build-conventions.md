---
trigger: model_decision
description: When modifying frontend HTML or JS files, adding new Tailwind classes, deploying the frontend, or managing frontend vendor/dependency files
---

## Frontend Build Conventions

This project uses a **vanilla HTML/CSS/JS frontend** (no bundler). All third-party dependencies are
**self-hosted** in `frontend/vendor/` — no external CDNs are used at runtime.

### Why No CDNs

External CDNs (jsDelivr, cdn.tailwindcss.com, cdnjs) are blocked on some networks. If Alpine.js
fails to load, the entire reactive system is dead — every `x-show`, `x-if`, `x-for` silently does
nothing. Everything must be served from Firebase Hosting.

### Vendored Dependencies

| File | Source | Purpose |
|---|---|---|
| `frontend/vendor/alpine.min.js` | Alpine.js 3.14.9 | Reactive UI directives |
| `frontend/vendor/three.min.js` | Three.js r128 | 3D mosaic preview |
| `frontend/vendor/OrbitControls.js` | Three.js r128 examples | 3D camera controls |
| `frontend/vendor/tailwind.css` | Built locally by CLI | All Tailwind utilities |
| `frontend/vendor/tailwind.input.css` | Source input | `@tailwind base/components/utilities` |

> **Never** add new CDN `<script>` or `<link>` tags for runtime dependencies. Download the file
> and add it to `frontend/vendor/` instead.

### Tailwind CSS Build (MANDATORY before deploying frontend)

Tailwind CSS is compiled at build time from `frontend/vendor/tailwind.input.css` using the Tailwind
CLI. The theme (colors, fonts, border-radius) lives in `tailwind.config.js` at the project root.

**When to rebuild `vendor/tailwind.css`:**
- You add, remove, or change any Tailwind utility class in `frontend/index.html` or `frontend/app.js`
- You change the theme (colors, fonts, spacing) in `tailwind.config.js`
- Before every frontend deployment (as a safety measure)

**How to rebuild:**
```bash
# From project root
npm run build:css
```

This runs:
```
tailwindcss -i frontend/vendor/tailwind.input.css -o frontend/vendor/tailwind.css --minify
```

> The CLI scans `frontend/**/*.html` and `frontend/**/*.js` (excluding `vendor/`) to discover
> class names used in the code. Classes that don't appear in those files won't be in the output.
> **Dynamic class construction** (e.g., `"text-" + color`) will NOT be detected — use
> `safelist` in `tailwind.config.js` if you need to preserve dynamically-built class names.

### Theme Changes

The design tokens live in `tailwind.config.js`:
- **Colors** — `theme.extend.colors` (e.g., `primary`, `on-background`, `surface-container`)
- **Font families** — `theme.extend.fontFamily` (`headline`, `body`, `label`)
- **Border radius** — `theme.extend.borderRadius`

After editing `tailwind.config.js`, always run `npm run build:css` and commit the rebuilt
`frontend/vendor/tailwind.css`.

### Updating a Vendored Dependency

1. Download the new version locally:
   ```bash
   curl -sL "<cdn-url>" -o frontend/vendor/<filename>
   ```
2. Update the version comment in `index.html` if present.
3. Commit the updated vendor file.
4. Deploy.

### Cache-Busting Strategy (MANDATORY)

This project uses a **two-tier caching architecture**:

1. **HTML files** (`index.html`, `privacy.html`, etc.) — served with `Cache-Control: no-cache`. Browsers always revalidate with the CDN. This guarantees users get the latest asset references on every visit.

2. **Versioned assets** (`app.js?v=X.Y`, `styles.css?v=X.Y`) — served with `Cache-Control: public, max-age=604800, immutable`. Browsers cache these aggressively and **never re-validate** as long as the URL is unchanged.

**The version query string is the ONLY mechanism for cache invalidation.** If you modify `app.js` or `styles.css` and deploy without bumping the `?v=` parameter, users will continue seeing the old file indefinitely.

#### Rules for Agents

1. **When you modify `app.js`**: You MUST bump the version in `index.html`:
   ```html
   <!-- Before -->  <script src="app.js?v=3.8"></script>
   <!-- After  -->  <script src="app.js?v=3.9"></script>
   ```

2. **When you modify `styles.css`**: You MUST bump the version in `index.html`:
   ```html
   <!-- Before -->  <link rel="stylesheet" href="styles.css?v=2.1"/>
   <!-- After  -->  <link rel="stylesheet" href="styles.css?v=2.2"/>
   ```

3. **When you modify `auth.js`**: Add a version query string if one doesn't exist, or bump it.

4. **Versioning scheme**: Use simple decimal increments (e.g., `3.8` → `3.9` → `3.10`).

5. **When in doubt, bump**: It costs nothing to bump a version unnecessarily. It costs a lot to forget — users get silently stuck on stale code with no error.

6. **`vendor/tailwind.css` is exempt**: It is rebuilt fresh from source each deploy and has no version string. The `immutable` cache header will serve the CDN's latest version after Firebase purges on deploy.

> **Anti-pattern**: Never remove version query strings. Never set them statically. Always increment.

### JavaScript Build (esbuild)

The app's JavaScript is modular ES6, bundled by esbuild into a single IIFE (`app.min.js`).
This happens alongside the Tailwind CSS build.

**When to rebuild `app.min.js`:**
- You modify any file under `frontend/js/` or `frontend/app.js`
- You add, move, or rename a function that is exported to `window.*`
- Before every frontend deployment

**How to rebuild:**
```bash
# JS only
npm run build:js

# Full build (CSS + JS)
npm run build
```

**Critical: `window.*` bridge pattern.** Because esbuild wraps everything in an IIFE, modules
communicate via `window.*` globals. These are NOT validated at build time — a missing
`window.renderMosaic` will only fail at RUNTIME (silently, due to defensive `if` guards).

After building, always verify critical functions exist:
```bash
grep -c "window\.renderMosaic" frontend/app.min.js  # should be > 0
```

See Frontend Module Architecture @frontend-module-architecture.md for the full cross-module
contract, refactoring checklist, and debugging guide.

### Related Rules
- Frontend Module Architecture @frontend-module-architecture.md
- Project Structure @project-structure.md
- Deploy Workflow @workflows/deploy.md
