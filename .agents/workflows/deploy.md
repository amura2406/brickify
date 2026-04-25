---
description: Deploy to production — intelligently deploys only affected layers (backend, frontend, or both)
---

# Deploy to Production

## Purpose
Deploy the application to production, deploying only the layers that were actually changed in the current conversation to minimize deployment time and risk.

## Prerequisites
- All code changes are committed (run `/5-commit` first if needed)
- Working directory is clean (`git status` shows no uncommitted changes)

## Steps

### 1. Determine Deployment Scope
// turbo
```bash
git diff --name-only HEAD~1
```

Analyze the changed files to decide deployment scope:
- **Files under `backend/`** → backend was changed
- **Files under `frontend/`** → frontend was changed
- **Files like `firebase.json`, `firestore.rules`** → frontend/rules deployment needed
- **Files like `deploy.sh`, `README.md`, `.agents/`** → no deployment needed (infra/docs only)

Build the deploy command based on scope:
| Changed          | Deploy Command Flags                     |
|------------------|------------------------------------------|
| Backend only     | `./deploy.sh --skip-frontend`            |
| Frontend only    | `./deploy.sh --skip-backend`             |
| Both             | `./deploy.sh`                            |
| Neither          | Skip deployment, inform user             |

### 2. Resolve CLI Paths

The shell environment may not have `gcloud` or `firebase` (via `npx`) on PATH by default. Always prepend the known paths:

```bash
export PATH=$PATH:/Users/amura/google-cloud-sdk/bin
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Execute Deployment

Run the deploy command determined in Step 1. This is a long-running command — use background execution and monitor with `command_status`.

**Frontend only:**

Before deploying frontend, **always rebuild Tailwind CSS** if any `.html` or `.js` file under
`frontend/` changed (or when in doubt). This ensures newly-added utility classes appear in the
generated CSS. See Frontend Build Conventions @rules/frontend-build-conventions.md for details.

```bash
# Step 1 — rebuild Tailwind and JS (run from project root)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && npm run build
```

**Step 1b — verify bundle integrity (MANDATORY):**

After building JS, verify that all critical `window.*` globals are present in the bundle.
Missing globals cause **silent failures** (black screens, dead buttons) with no console errors,
because calling code uses defensive `if (window.fn)` guards.

See Frontend Module Architecture @rules/frontend-module-architecture.md for the full contract.

```bash
echo "=== Bundle Integrity Check ===" && \
for fn in renderMosaic renderLegend applyZoom generateMosaic \
          hideReferenceLayerImmediately loadProject openDeleteProjectDialog \
          renderQuickChips showColorPopover; do \
    count=$(grep -c "window\.$fn" frontend/app.min.js 2>/dev/null || echo 0); \
    if [ "$count" -eq "0" ]; then \
        echo "❌ MISSING: window.$fn not found in bundle!"; \
    else \
        echo "✅ window.$fn ($count references)"; \
    fi; \
done
```

> **If any function shows ❌ MISSING:** STOP. Do not deploy. Find the source module that should
> define and export this function. See the debugging guide in
> Frontend Module Architecture @rules/frontend-module-architecture.md.

**Step 2 — verify cache-busting versions were bumped (MANDATORY):**

If `app.js`, `styles.css`, or `auth.js` were modified in this conversation, you MUST verify
that their `?v=` query string in `index.html` was incremented. If not, bump it now before
deploying. Failure to do this means users with cached assets will be stuck on stale code
with **no error and no indication** — a silent, invisible regression.

Check with:
```bash
grep -E 'app\.js\?v=|styles\.css\?v=|auth\.js\?v=' frontend/index.html
```

```bash
# Step 3 — deploy hosting
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && npx firebase-tools deploy --only hosting --project brickify999
```

**Backend only:**
```bash
PATH=$PATH:/Users/amura/google-cloud-sdk/bin ./deploy.sh --skip-frontend
```

**Both (full deploy):**
```bash
PATH=$PATH:/Users/amura/google-cloud-sdk/bin ./deploy.sh --skip-frontend
```
Then after backend completes:
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && npx firebase-tools deploy --only firestore:rules,hosting --project brickify999
```

> **Why not just `./deploy.sh`?** The deploy script calls `firebase` directly which isn't on PATH.
> We split into two commands: gcloud-based backend via the script, and firebase-based frontend via npx.
> When only frontend changed, skip the script entirely and call firebase directly.

### 4. Verify Deployment

After deployment completes, confirm the output shows success:
- Backend: look for `✅  Backend deployed:` with a Cloud Run URL
- Frontend: look for `✔  Deploy complete!` and `Hosting URL: https://brickify999.web.app`

### 5. Report
Summarize to the user:
- Which layers were deployed (and which were skipped, with reason)
- The live URLs
- The version that was deployed

## Completion Criteria
- [ ] Deployment scope correctly identified from changed files
- [ ] Only affected layers deployed
- [ ] Deployment succeeded with no errors
- [ ] User informed of live URLs and deployed version
