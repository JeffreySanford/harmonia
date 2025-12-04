# Security Guidelines

This document outlines security best practices developers and CI systems should follow for the Harmonia repository.

1. Secrets must never be committed to the repository

   - Store secrets (passwords, keys, tokens) in `.env` files or the deployment environment secret store.
   - Use `.env` for local development and test environment credentials. `.env` is gitignored.

2. Test credentials

   - Do not hardcode passwords in test files or documentation. Reference `E2E_TEST_USER_*` and `E2E_ADMIN_*` environment variables.
   - Use the `scripts/add-test-user.js` script to seed users into the `harmonia_test` DB; do not commit passwords to source.

## Sessions & Tokens

- Never store plaintext passwords in session storage, cookies, or JWT payloads.
- JWTs should include `sub` (user id), username, and role — not the password.
- On logout, clear localStorage/sessionStorage and invalidate sessions as appropriate.

## Tests & CI

- Tests should never hardcode credentials. Use `E2E_TEST_USER_*` and `E2E_ADMIN_*` environment variables.
- E2E seeds should use `scripts/add-test-user.js` and `scripts/setup-e2e-tests.sh` must read `E2E_TEST_USER_*` from `.env` or CI secrets.
- Developer convenience: A `DEV_AUTOGEN_TEST_USER` option exists for local development to auto-create a weak test user (`test/password`) if `E2E_*` env vars are missing — **do not** enable this in CI or production, and remove or change the credentials before sharing any environment files.
- Ensure tests always clear localStorage and sessionStorage between test cases (`localStorage.clear()`/`sessionStorage.clear()`).

## Rate Limiting & Throttling

- Implement production rate limiting using distributed stores (Redis) for real deployments.
- In dev/testing, allow disabling throttling via an `ENV` flag to keep E2E reliable.

## Two-Factor Authentication (2FA)

- Implement 2FA for admin users in a future release; document recommended TOTP/HOTP flows, backup codes, and user opt-in flows.

---

Follow these guidelines strictly. Security is important and these practices reduce the risk of accidental credential exposure and improve test reliability.

---

Follow these guidelines strictly. Security is important and these practices reduce the risk of accidental credential exposure and improve test reliability.
