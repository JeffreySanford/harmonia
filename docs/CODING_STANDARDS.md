# Harmonia Coding Standards (Draconian)

Purpose
This document codifies rigid, enterprise-style coding standards for the Harmonia project across Angular, NestJS, and Python services. These rules are intentionally strict to enforce consistency, reviewability, and long-term maintainability.

Philosophy (top-level)
- Consistency over cleverness. Prefer explicit, well-documented solutions.
- Minimal implicit behavior. No magic; all side-effects must be declared and reviewed.
- Prefer readability, testability, and strong typing.

General repository rules
- **Strict typing**: Typescript `strict` enabled in `tsconfig.json`; Python `mypy` for typed modules.
- **No secrets in repo**. Use `.env` (gitignored) and CI secrets.
- **File size limits**: Maximum 500 lines per file (target 300-400). Refactor into modules when approaching limit.
- **Single responsibility**: Each file should have one clear purpose. Split large files into logical submodules.
- **Pull requests must include**: description, test plan, manifest/checksum updates (if artifacts changed), and at least one approving reviewer.

File Organization & Size Management
- **Maximum file size**: 500 lines (hard limit), 300-400 lines (target)
- **When to refactor**: 
  - File exceeds 400 lines → plan refactoring
  - File exceeds 500 lines → immediate refactoring required
- **Refactoring patterns**:
  - Extract related functions into separate modules
  - Move types/interfaces to shared `types.ts` or `models.ts`
  - Split large classes into composition-based smaller classes
  - Create barrel exports (`index.ts`) for clean public APIs
- **Documentation requirement**: Update all imports and references after refactoring
- **CI enforcement**: Add ESLint rule `max-lines` and pre-commit hook to flag violations

Angular (frontend)
- No standalone components. Use NgModules for all feature modules.
- No direct DOM manipulation. Use Angular APIs and Renderer2 when necessary.
- Minimal use of Promises/async: prefer Observables and `async` pipe; avoid raw Promise chains in components. (Async IO is allowed in effects/services where appropriate.)
- NGRX for state: strict reducer-only state changes, actions are single-purpose and small.
- UI components must be purely presentational; all data fetching and orchestration belong to container components or effects.
- No `any` types; prefer explicit interfaces and DTOs.

NestJS (backend)
- Use dependency injection for all services; avoid singletons with hidden state.
- Use DTOs and class-validator for input validation; no untyped `any` bodies.
- Keep controllers thin; orchestration in services.
- Avoid promiscuous `async` everywhere: only use async for real IO (DB, network, file I/O). CPU-bound operations should be synchronous or delegated to worker processes.

Python (worker libraries)
- Prefer explicit function signatures and type hints.
- Keep heavy I/O (model loads, file writes) isolated behind small, testable interfaces.
- No global state: use function-scoped objects or dependency-injected objects.

Testing and CI
- Every change touching runtime logic needs unit tests. Use Jest for TS, pytest for Python.
- Integration tests use small mocked models or minimized artifacts; heavy model runs are offline tests or scheduled infra runs.

Style and linting
- ESLint + Prettier for TypeScript/Angular with enforced rules for NGRX patterns.
- Mypy and pylint for Python; flake8 as a secondary check.
- Pre-commit hooks to run linters and tests for changed files.

Code review policy
- PRs must include architecture/behavior rationale for non-trivial changes.
- No merges without passing CI and one approving review.

Exceptions
- Occasionally exceptions are required (e.g., for performance proofs). Any exception must be documented in the PR and recorded in `docs/EXCEPTIONS.md`.

---
End of coding standards.
