# E2E Navigation Tests

This document describes Playwright E2E tests that verify navigation behaviors, especially around route protections and session invalidation.

## Tests Added

- `tests/e2e/navigation.spec.ts`
  - Guest behavior: assert that visiting `/generate/song` and `/generate/music` as a guest redirects to `/`.
  - Session invalidation: asserts that when a logged-in user visits a protected route and the token is invalidated (corrupted/expired) the app redirects to `/` on reload.
  - Health indicator validation: ensures the login modal shows a dev-only backend reachability indicator when running locally.

## Usage

1. Start Backend & Frontend
   - Backend: `pnpm nx serve backend` or `pnpm run dev` in separate terminal
   - Frontend: `pnpm nx serve frontend`
2. Run Playwright tests (requires dev servers to be running):

   ```bash
   pnpm test:e2e
   ```

## Notes

- The tests use helper `tests/e2e/helpers/auth.ts` for login and registration, with resilient retry/fallback behavior.
- In CI, ensure `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and `E2E_TEST_USER_*` environment variables are seeded and available.
- Use `llm:mock` for deterministic LLM outputs when testing flows that call LLM endpoints.
