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

- **No standalone components**: All components must use `standalone: false`. ESLint rule enforced via `.eslint/rules/no-standalone-components.mjs`.
- **NgModule-based architecture**: Use feature modules with lazy loading for all routes.
- **Separated files required**: Every component must have separate `.ts`, `.html`, and `.scss` files. No inline templates or styles.
  - Enforcement: ESLint rules are enabled in `apps/frontend/.eslintrc.json`:
    - `@angular-eslint/no-inline-template: "error"`
    - `@angular-eslint/no-inline-styles: "error"`
  - Rationale: Separate templates and styles improve diffability, accessibility of changes, and enable tooling like template linting and SCSS `@use` imports.
- **SCSS @use pattern**: All component SCSS files must `@use` from `styles/` folder (colors, mixins, typography, layout, animations).
- **Flexbox-first layout**: Use Flexbox for positioning. Avoid absolute positioning unless necessary.
- **No direct DOM manipulation**: Use Angular APIs and Renderer2 when necessary.
- **Minimal use of Promises/async**: prefer Observables and `async` pipe; avoid raw Promise chains in components. (Async IO is allowed in effects/services where appropriate.)
- **NGRX for state**: strict reducer-only state changes, actions are single-purpose and small, follow `[Feature] Action Name` pattern.
- **Smart vs Presentational**: Container components connect to NGRX, presentational components use @Input/@Output only.
- **UI components must be purely presentational**: all data fetching and orchestration belong to container components or effects.
- **No `any` types**: prefer explicit interfaces and DTOs.
- **Material Design 3**: Use Angular Material components with custom Legendary theme (aurora/sunset/prairie colors).

NestJS (backend)

- Use dependency injection for all services; avoid singletons with hidden state.
- Use DTOs and class-validator for input validation; no untyped `any` bodies.
- Keep controllers thin; orchestration in services.
- Avoid promiscuous `async` everywhere: only use async for real IO (DB, network, file I/O). CPU-bound operations should be synchronous or delegated to worker processes.
- **Swagger/OpenAPI documentation required**: All controllers, endpoints, DTOs, and responses must be fully documented with @nestjs/swagger decorators. Every endpoint must include @ApiOperation, @ApiResponse (success and error cases), and appropriate @ApiTags. DTOs must use @ApiProperty decorators for all properties. This ensures comprehensive API documentation and developer experience.

Python (worker libraries)

- Prefer explicit function signatures and type hints.
- Keep heavy I/O (model loads, file writes) isolated behind small, testable interfaces.
- No global state: use function-scoped objects or dependency-injected objects.

Testing and CI

- Every change touching runtime logic needs unit tests. Use Jest for TS, pytest for Python.
- Integration tests use small mocked models or minimized artifacts; heavy model runs are offline tests or scheduled infra runs.

Secrets & Test Users

- Never commit secrets to the repo. Use `.env` files that are gitignored for local development and a secure secret store for CI.
- For E2E tests, set `E2E_TEST_USER_*` and `E2E_ADMIN_*` environment variables in `.env` or CI secrets; do not hardcode credentials in tests or docs.
- Use `scripts/add-test-user.js` to seed test users and decrypt test passwords with `ENCRYPTION_KEY` if needed. Always keep `ENCRYPTION_KEY` and encrypted secrets in secure secret stores.

Session Handling & Tests

- Do not include passwords in session tokens or JWT payloads. JWT should carry only `sub`, username, and roles.
- Always clear localStorage and sessionStorage in tests to avoid session leakage between tests. (E2E test files should call `localStorage.clear()` and `sessionStorage.clear()` in `beforeEach`.)

Rate limiting & Tests

- Production rate limiting should be enforced via Redis or similar distributed store using a library such as `@nestjs/throttler` or `express-rate-limit`.
- For test/e2e environments, provide an environment flag (e.g. `DISABLE_THROTTLING=true`) to disable or relax throttling to avoid rate-limiting failing deterministic tests. Ensure the flag is not enabled in production.

Two-Factor Authentication (2FA)

- 2FA is recommended for admin accounts and should be implemented as a future feature. Document the recommended TOTP flows and backup code issuance. 2FA should be enforced via user setting (opt-in) for admins.

Style and linting

- **ESLint + Prettier** for TypeScript/Angular with enforced rules for NGRX patterns and no standalone components.
- **Custom ESLint rule**: `.eslint/rules/no-standalone-components.mjs` prevents `standalone: true` in @Component decorators.
- **SCSS architecture**: Modular SCSS in `styles/` folder with `@use` imports in all component SCSS files.
- **Mypy and pylint** for Python; flake8 as a secondary check.
- **Pre-commit hooks** to run linters and tests for changed files.

Nx workspace commands

- **Development**: `pnpm dev` (serves frontend + backend in parallel)
- **Build**: `pnpm build:all` (builds all apps)
- **Test**: `pnpm test` (runs all tests), `pnpm test:watch` (watch mode)
- **Lint**: `pnpm lint` (lints all), `pnpm lint:fix` (auto-fix)
- **E2E**: `pnpm e2e:frontend` and `pnpm e2e:backend`
- All commands use Nx for caching and parallel execution.

Code review policy

- PRs must include architecture/behavior rationale for non-trivial changes.
- No merges without passing CI and one approving review.

Exceptions

- Occasionally exceptions are required (e.g., for performance proofs). Any exception must be documented in the PR and recorded in `docs/EXCEPTIONS.md`.

---

End of coding standards.
