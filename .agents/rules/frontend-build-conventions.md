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

### Related Rules
- Project Structure @project-structure.md
- Deploy Workflow @workflows/deploy.md
