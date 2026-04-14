# Codebase Audit Task Tracker: LEGO Mosaic Maker
**Date**: April 14, 2026
**Purpose**: Track the resolution of the SEV-0 through SEV-3 codebase audit findings. Use this artifact across AI sessions to track what was fixed and how.

## [SEV-0] Security & Rugged Execution Mandates
- [x] **Fix Google OAuth Leak in `GET` Requests**
  - **Issue**: Google API tokens (`google_access_token`) are sent via plaintext queries in `GET` routes (`/api/gphotos/session`, `/api/gphotos/albums`), exposing them to logs.
  - **Resolution Strategy**: Move the `google_access_token` from URL parameters to the `Authorization: Bearer <token>` header, or use stateful `POST` bodies.
  - **Fix Details**: Moved `google_access_token` from the query parameters to the `X-Google-Access-Token` request header. Updated `authFetch()` in the frontend and used `Header(...)` in FastAPI request handlers to consume the tokens securely without exposing them in logs.

## [SEV-1] Testability-First Architectural Patterns
- [ ] **Implement Unit Test Coverage (Zero tests currently)**
  - **Issue**: No automated tests (`*test*.py` or `*spec.js`) exist in the repository, making I/O abstraction and algorithmic changes extremely brittle.
  - **Resolution Strategy**: Establish a `pytest` framework. Add unit tests for `algos/` (pure function behavior) and mock the `DatabaseProvider` and `StorageProvider`.
  - **Fix Details**: *(Leave blank until fixed)*
- [ ] **Refactor `main.py` Monolith**
  - **Issue**: `backend/main.py` is 750+ lines long, blending HTTP routing, business logic, file handling, and external API calls.
  - **Resolution Strategy**: Create strict boundaries (e.g., `features/photo/`, `features/project/`) extracting pure domain logic away from HTTP handlers.
  - **Fix Details**: *(Leave blank until fixed)*

## [SEV-2] Code Idioms & Reliability Patterns
- [ ] **Resolve Broad Exception Swallowing**
  - **Issue**: There are ~16 occurrences of `except Exception:` in `main.py` and `storage.py`, masking critical bugs.
  - **Resolution Strategy**: Swap blanket exceptions for bounded domain exceptions (e.g., `ValueError`, `httpx.HTTPError`). If generic catch-alls are absolutely necessary, add structured logging (`logger.error(..., exc_info=True)`).
  - **Fix Details**: *(Leave blank until fixed)*

## [SEV-3] Dependency Management & Build Stability
- [ ] **Explicitly Declare Unmapped Dependencies**
  - **Issue**: `httpx` is used but missing from `pyproject.toml`. It is only working accidentally due to `firebase-admin` importing it transitively. 
  - **Resolution Strategy**: Add `httpx` to `pyproject.toml`.
  - **Fix Details**: *(Leave blank until fixed)*
- [ ] **Fix Dockerfile Fallback Definitions**
  - **Issue**: `python-dotenv` is omitted from the un-cached dependency block inside the `Dockerfile`.
  - **Resolution Strategy**: Add it to the Dockerfile installation list.
  - **Fix Details**: *(Leave blank until fixed)*

## [SEV-4] Frontend Technical Debt
- [ ] **Implement Client-Side State Safety (Optional Scale Feature)**
  - **Issue**: Heavy DOM manipulation is done manually in Vue/Alpine's absence, risking disjointed layout states in the 'Compare Arena'.
  - **Resolution Strategy**: Introduce Alpine.js or Vue.js for managing complex client-side comparisons.
  - **Fix Details**: *(Leave blank until fixed)*
