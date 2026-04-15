# AGENTS.md

> **Purpose:** This file describes the coding standards, architectural rules, workflows, and agent skills used in this repository. It helps AI coding agents (Jules, Gemini, etc.) understand the project's conventions and produce consistent, high-quality code.

## Project Overview

**Brickify (lego-mosaic-maker)** — A web application that converts photos into LEGO mosaic art.

- **Backend:** Python 3.11+ / FastAPI, deployed on Google Cloud Run
- **Frontend:** Vanilla HTML/CSS/JavaScript with Alpine.js, deployed on Firebase Hosting
- **Database:** Firestore (with local JSON fallback for development)
- **Storage:** Firebase Storage (with local filesystem fallback)
- **Auth:** Firebase Authentication (Google Sign-In)

### Project Structure

```
backend/
  main.py                    # FastAPI app entry point
  auth.py                    # Firebase Auth middleware
  database.py                # DatabaseProvider abstraction (Firestore + Local)
  storage.py                 # StorageProvider abstraction (Firebase + Local)
  mosaic.py                  # Core mosaic generation logic
  pdf_export.py              # PDF instruction export
  lego_sets.py               # LEGO set data management
  algos/                     # Pure algorithm modules
    color_math.py            # Color space conversions (RGB, LAB, CIEDE2000)
    realistic.py             # Realistic mosaic generation
    gradient.py              # Gradient mapping
    pop_art.py               # Pop art style generation
  features/                  # Feature-based vertical slices
    mosaic/                  # Mosaic generation feature
    project/                 # Project CRUD (save/load/delete)
    photo/                   # Google Photos integration
    lego_set/                # LEGO set browsing
    admin/                   # Admin panel (user approval, storage mgmt)
    user/                    # User profile
    config/                  # Firebase config endpoint
frontend/
  index.html                 # Main SPA
  app.js                     # Core application logic
  auth.js                    # Firebase Auth client
  styles/                    # CSS files
docs/
  backlog.md                 # Feature backlog and known issues
```

---

## Rule Priority (When Rules Conflict)

When two rules pull in opposite directions, use this priority:

1. **Security Mandate** — always wins
2. **Rugged Software Constitution** — foundational philosophy
3. **Code Completion Mandate** and **Logging Mandate** — always-on enforcement
4. **Testability-First Design** — maintainability enables future improvements
5. **Feature-specific principles** — context-dependent guidance
6. **PRD-gated principles** — only when explicitly required
7. **YAGNI / KISS** — only when no security/reliability/maintainability trade-off

### Common Conflict Resolutions

| Conflict | Resolution |
|---|---|
| YAGNI vs Security | **Security wins.** Input validation is always needed. |
| KISS vs Testability | **Testability wins.** Interfaces enable testing. |
| Performance vs YAGNI | **Measure first.** Only optimize after profiling. |
| DRY vs Clarity | **Clarity wins** until duplication reaches 3+ instances. |
| Speed vs Logging | **Logging wins.** Silent failures are the enemy. |

---

## Rugged Software Constitution

### Core Philosophy

**"I recognize that my code will be attacked."**

Code must be **defensible** — not just functional. Every input is malformed, malicious, or incorrect until proven otherwise.

### The 7 Rugged Habits

1. **Defense-in-Depth** — validate at every boundary (API, DB, function call)
2. **Instrument for Awareness** — silent failures are enemy #1
3. **Reduce Attack Surface** — remove unused code/deps/endpoints
4. **Design for Failure** — assume DB will go down, network will timeout
5. **Clean Up After Yourself** — own acquired resources; release them
6. **Verify Your Defenses** — test unhappy paths as rigorously as happy paths
7. **Adapt to the Ecosystem** — use battle-tested libraries over custom implementations

---

## Security Mandate

**Security is a foundational requirement, not a feature.**

1. **Never trust user input** — validate server-side
2. **Deny by default** — require explicit permission grants
3. **Fail securely** — fail closed (deny access) not open
4. **Defense in depth** — multiple layers of security

### Security Principles

- **Input Validation:** Validate type, length, format, and range at every entry point
- **Authentication:** Use Firebase Auth; verify ID tokens server-side on every request
- **Authorization:** Check user permissions before every operation
- **SQL/NoSQL Injection:** Always use parameterized queries
- **Secrets:** Never hardcode; use environment variables or secret managers
- **HTTPS:** All communication over TLS
- **Headers:** Set security headers (CORS, CSP, X-Frame-Options)
- **Error Messages:** Never expose internal details to users
- **Dependencies:** Run `pip-audit` regularly

---

## Architectural Patterns — Testability-First Design

### Core Principle

All code must be independently testable without running the full application or external infrastructure.

### Rule 1: I/O Isolation

Abstract all I/O behind interfaces/contracts:
- Database queries → `DatabaseProvider` protocol
- Storage operations → `StorageProvider` protocol  
- HTTP calls → Service classes with injected API clients
- File system operations → abstracted adapters

Before implementing, search for existing patterns: `Interface`, `Mock`, `Repository`, `Store`, `Adapter`, `Protocol`.

### Rule 2: Pure Business Logic

Extract calculations, validations, transformations into pure functions:
- Input → Output, no side effects
- Deterministic: same input = same output
- No I/O inside business rules

**Example (this codebase):**
```python
# ✅ Pure — in algos/color_math.py
def ciede2000(lab1, lab2) -> float:
    # Pure calculation, no I/O
    ...

# ✅ I/O in router, pure logic separate
# router.py: fetch data → call pure fn → persist result
```

### Rule 3: Dependency Direction

```
Infrastructure (DB, HTTP, Files) 
  → depends on → Contracts/Interfaces 
    → depends on → Business Logic (pure functions, NO infra imports)
```

### Pattern Discovery Protocol

Before implementing ANY feature:
1. Search existing patterns (MANDATORY)
2. Examine 3 existing modules for consistency
3. Document pattern (>80% consistency required)
4. If consistency <80%: STOP and report

### Testability Compliance Checklist

- [ ] Unit tests run without starting database/external services?
- [ ] All I/O operations behind an abstraction?
- [ ] Business logic pure (no side effects)?
- [ ] Integration tests exist for all adapters?
- [ ] Pattern matches existing codebase (>80%)?

---

## Code Completion Mandate

**Before marking any code task complete, run automated quality checks and remediate ALL issues.**

### Completion Workflow

1. **Generate** — Write the code
2. **Validate** — Run quality checks (see below)
3. **Remediate** — Fix all detected issues
4. **Verify** — Re-run checks to confirm fixes
5. **Deliver** — Mark complete only after all checks pass

### Python Quality Commands

| Tool | Purpose | Command |
|---|---|---|
| `ruff format` | Formatting | `ruff format .` |
| `ruff check` | Linting | `ruff check . --fix` |
| `mypy` | Type checking | `mypy src/ --strict` |
| `bandit` | Security scanning | `bandit -r src/ -c pyproject.toml` |
| `pip-audit` | Dependency CVEs | `pip-audit` |
| `pytest` | Tests | `pytest` |

> Never disable a lint rule or suppress a warning to make checks pass. Fix the root cause.

---

## Core Design Principles

### SOLID Principles

- **SRP:** Each class/function has ONE reason to change
- **OCP:** Open for extension, closed for modification
- **LSP:** Subtypes substitutable for base types
- **ISP:** Many small interfaces > one large interface
- **DIP:** Depend on abstractions, not concretions

### Essential Practices

- **DRY:** Eliminate code duplication through proper abstraction
- **YAGNI:** Don't implement functionality before it's needed
- **KISS:** Simple solutions over complex ones
- **Separation of Concerns:** Isolate each concern in its own module
- **Composition Over Inheritance:** Favor composition and delegation
- **Principle of Least Astonishment:** Code behaves as expected

**User Experience vs Maintainability:** When they conflict, prefer maintainable code that can evolve. Never sacrifice code quality for short-term UX gains.

---

## Code Organization Principles

### Feature-Based Organization

Organize by FEATURE, not by technical layer:

```
features/
  task/
    service.py          # Public API (Service class)
    router.py           # HTTP handlers (FastAPI router)
    models.py           # Domain models
    logic.py            # Pure domain functions (no I/O)
    storage.py          # Storage Protocol (interface)
    storage_mock.py     # Test implementation
    service_test.py     # Unit tests
```

### Rules

- One feature = one directory
- Each module exposes a public API
- Internal implementation details are private
- Cross-module calls only through public API
- Never create circular dependencies

---

## Project Structure — Python Backend

### Key Conventions

- **Feature packages** use `__init__.py` — keep it empty or re-export public API
- **Tests co-locate** with the code they test (`*_test.py` in same directory)
- **E2E tests** go in `tests/e2e/` at project root
- Use FastAPI's `Depends()` for dependency injection
- Configure all tools in `pyproject.toml`

### Dependency Wiring (FastAPI Depends)

```python
# In router.py
def get_service(db=Depends(get_db)) -> TaskService:
    storage = PostgresStorage(db)
    return TaskService(storage)

@router.post("/tasks/")
async def create_task(req: Request, svc: TaskService = Depends(get_service)):
    return await svc.create(req)
```

---

## Python Idioms and Patterns

### Type Annotations (Mandatory)

- ALL public functions must have type annotations
- Use `Protocol` (not ABC) for interfaces
- Use `dataclass(frozen=True)` for value objects
- Use `TypeAlias` for complex types

### Error Handling

```python
# ✅ Domain-specific exceptions
class NotFoundError(DomainError):
    def __init__(self, entity: str, entity_id: str):
        super().__init__(f"{entity} '{entity_id}' not found")

# ✅ Structured error propagation
try:
    user = await store.get_by_id(user_id)
except NotFoundError:
    raise HTTPException(status_code=404, detail="User not found")
```

### Naming Conventions (PEP 8)

| Construct | Convention | Example |
|---|---|---|
| Module/Package | `snake_case` | `task_service.py` |
| Class | `PascalCase` | `TaskService` |
| Function/Method | `snake_case` | `get_by_id` |
| Private | `_snake_case` | `_validate_title` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_TITLE_LENGTH` |
| Protocol | `PascalCase` | `TaskStorage` |

### Testing

- Use `pytest` as the sole test runner
- Parametrize with `@pytest.mark.parametrize`
- Use `pytest-mock` (`mocker` fixture) for mocking
- Use typed mock factories for Protocol-based interfaces
- Use `pytest-asyncio` for async tests
- Fixtures for reusable setup

### Idiomatic Patterns

- Context managers for resource cleanup (`with`/`async with`)
- Generator expressions for lazy evaluation
- `dataclasses.replace()` for immutable updates
- `functools.cache` for pure function memoization
- `enum.Enum` for domain constants (not raw strings)
- Never use `print()` in production code — use `logging` or `structlog`

---

## Error Handling Principles

1. **Never Fail Silently** — no empty catch blocks
2. **Fail Fast** — detect errors early, validate at boundaries
3. **Provide Context** — error codes, correlation IDs, actionable messages
4. **Separate Concerns** — business errors ≠ technical errors ≠ security errors
5. **Resource Cleanup** — always clean up in error scenarios
6. **No Information Leakage** — sanitize error messages for external consumption

---

## Logging and Observability Mandate

### Every Operation Must Be Logged

**Operation = API endpoint, background job, event handler, external service call, DB transaction**

**3-point logging requirement:**
1. **Operation start** — log with context (correlationId, userId, operation name)
2. **Operation success** — log completion with duration
3. **Operation failure** — log error with full context

**Mandatory context:** `correlationId`, `operation`, `duration`, `userId`, `error`

### Log Levels

| Level | When |
|---|---|
| DEBUG | Detailed diagnostic info (dev only) |
| INFO | Normal operations, state changes |
| WARN | Recoverable issues, degraded performance |
| ERROR | Operation failures requiring attention |
| CRITICAL | System-wide failures requiring immediate action |

---

## Testing Strategy

### Test Pyramid

- **Unit tests (70%)** — pure functions, business logic; fast, no I/O
- **Integration tests (20%)** — adapter tests with real infrastructure
- **E2E tests (10%)** — full user journey validation

### Naming Convention

```
test_{what_is_being_tested}_{scenario}_{expected_result}
```

Example: `test_calculate_discount_expired_coupon_returns_zero`

### Unit Test Requirements

- Run without ANY external service
- Use mock/fake implementations for I/O
- Test happy path AND error cases
- One assertion per test (or closely related assertions)

### Test Co-location

- Unit and integration tests live next to the code they test
- E2E tests in `tests/e2e/` directory

---

## Configuration Management

### Hierarchy (highest to lowest precedence)

1. Command-line arguments
2. Environment variables
3. Config files
4. Defaults in code

### Rules

- Never hardcode configuration in code
- Validate all required config at startup (fail fast)
- Use `.env.template` (committed) + `.env.development` (not committed)

---

## Database Design

- Start with 3NF, denormalize only when performance requires it
- Tables: plural, snake_case; Columns: singular, snake_case
- Required columns: `id`, `created_at`, `updated_at`
- Always use parameterized queries (no SQL injection)
- Keep transactions short and focused

---

## Dependency Management

- **Pin exact versions** in production
- **Commit lock files** (`requirements.txt` / `poetry.lock`)
- **Minimize dependencies** — ask "Can I implement this in 50 lines?"
- **Organize imports:** stdlib → external → internal
- Remove unused imports

---

## API Design Principles

### RESTful Conventions

| Operation | HTTP Method | URL Pattern | Response |
|---|---|---|---|
| List | GET | `/api/resources` | 200 + array |
| Get | GET | `/api/resources/{id}` | 200 + object |
| Create | POST | `/api/resources` | 201 + object |
| Update | PUT/PATCH | `/api/resources/{id}` | 200 + object |
| Delete | DELETE | `/api/resources/{id}` | 204 |

### Error Response Format

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "User-friendly message",
  "correlationId": "uuid-for-tracking"
}
```

### API Rules

- Version APIs (`/api/v1/...`) for breaking changes
- Use pagination for list endpoints (`page`, `page_size`)
- Set rate limits on public endpoints
- Validate request bodies with Pydantic models
- Return appropriate HTTP status codes

---

## Resource and Memory Management

- **Acquire Late, Release Early** — hold resources for minimum time
- **Always use cleanup patterns** — `with`/`try-finally`/context managers
- **Set timeouts** on all external calls
- **Implement circuit breakers** for external services
- **Monitor resource usage** — connection pools, memory, file handles

---

## Performance Optimization

- **Measure before optimizing** — use profiling tools
- **Optimize bottlenecks only** — not "everything"
- **Cache appropriately** — computed values, DB query results
- **Use async I/O** for I/O-bound operations
- **Batch operations** where possible (bulk DB writes)
- **Set timeouts** on all external calls

---

## Concurrency and Threading

- **I/O-Bound:** Use async/await (FastAPI is async-native)
- **CPU-Bound:** Use `concurrent.futures.ProcessPoolExecutor`
- Don't over-use concurrency — profile first
- Prevent race conditions with proper locking
- Never hold locks during I/O operations

---

## Documentation Principles

- Code shows WHAT; comments explain WHY
- All public functions need docstrings (parameters, returns, errors)
- README for setup and usage
- Architecture docs for system design

---

## Git Workflow

### Commit Messages (Conventional Commits)

```
<type>(<scope>): <subject>

[optional body]
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`

**Rules:**
- Subject ≤ 50 chars, imperative mood
- Body explains WHY, not WHAT
- One logical change per commit

### Branch Naming

```
<type>/<short-description>
```

Examples: `feat/mosaic-export`, `fix/compare-arena-bug`

---

## Accessibility Principles

- Use semantic HTML elements
- All images need `alt` text
- Ensure keyboard navigation works
- Meet WCAG 2.1 AA contrast ratios
- Use ARIA attributes where semantic HTML is insufficient
- Test with screen readers

---

## Command Execution Principles

- Never execute user input directly
- Use argument lists, not shell string concatenation
- Run with minimum permissions
- Check exit codes and capture stderr
- Set timeouts for long-running commands

---

## Data Serialization

- Use Pydantic models for JSON serialization/deserialization
- Validate all incoming data at system boundaries
- Use ISO 8601 for dates/times
- Use UTC everywhere; convert to local time only in the frontend

---

## Secrets Management

- Never commit secrets to git
- Use `.env.template` (committed) with blank values
- Use `.env.development` (gitignored) for local secrets
- In production, use platform secret managers (Cloud Run secrets, etc.)
- Rotate secrets regularly

---

## Browser Testing Bypasses (Development Only)

For automated browser testing, the app supports dev-only query parameters:

- `?bypass_login=true` — skip Firebase Auth, use mock user
- `?test_file=/path/to/file.jpg` — auto-load test image
- Combined: `http://localhost:8000/?bypass_login=true&test_file=/path/to/file.jpg`

> These MUST be disabled in production builds.

---

## Workflows

The project uses a phased development workflow:

| Phase | Name | Purpose |
|---|---|---|
| 1 | **Research** | Understand context, gather knowledge before coding |
| 2 | **Implement** | Write code following TDD cycle |
| 3 | **Integrate** | Test adapters with real infrastructure |
| 4 | **Verify** | Run full validation suite (lint, type-check, test) |
| 5 | **Commit** | Git commit with conventional format |

### Additional Workflows

| Workflow | Purpose |
|---|---|
| **Orchestrator** | Chains all phases sequentially; no phase skipping |
| **Quick-Fix** | Fast-track bug fixes; skip research, minimal verify |
| **Refactor** | Safely restructure code while preserving behavior |
| **Audit** | Code review and quality verification; produces findings report |
| **Deploy** | Deploy to production (backend → Cloud Run, frontend → Firebase Hosting) |
| **E2E Test** | End-to-end testing with Playwright |
| **Perf Optimize** | Profile-driven performance optimization |

---

## Skills (Agent Capabilities)

| Skill | Description |
|---|---|
| **ADR** | Architecture Decision Record — document significant decisions with context, options, consequences |
| **Code Review** | Structured code review protocol against the full rule set |
| **Debugging Protocol** | Systematic hypothesis-based debugging for complex bugs |
| **Frontend Design** | Generate production-grade frontend interfaces (HTML/CSS/JS) |
| **Guardrails** | Pre-flight checklist and post-implementation self-review |
| **Performance Optimization** | Profile-driven optimization protocol with pattern catalog |
| **Sequential Thinking** | Dynamic problem-solving through iterative thought chains |
| **Caveman** | Ultra-compressed communication mode (~75% token savings) |

---

## Monitoring and Alerting

### Health Checks

- `/health` endpoint for liveness checks
- Include dependency checks (DB, external services)

### Metrics (RED Method for services)

- **Rate** — requests per second
- **Errors** — error rate / percentage
- **Duration** — response time percentiles (p50, p95, p99)

### Alerting Rules

- Alert on error rate > 1% for 5 minutes
- Alert on p99 latency > 2s for 5 minutes
- Alert on health check failures for 3 consecutive checks
