# Developer Health Check (Dev-Only)

This short guide documents the development-only health check used to verify backend reachability from the UI.

> ⚠️ Dev-only: Only enabled for local development (localhost) and not meant for production or public environments.

## Purpose

- Small `GET /api/__health` endpoint for quick backend reachability checks.
- Frontend shows a development-only indicator in UI (header & login modal).

## Backend

- Route: `GET /api/__health`.
- Response: `200 OK` JSON: `{ "ok": true }`.
- Implementation: `apps/backend/src/health/health.controller.ts`.

## Frontend

- `HealthService` (apps/frontend/src/app/services/health.service.ts) exposes `isBackendReachable()` and returns a `Observable<boolean>`.
- UI dev-only indicators:
  - Header: `apps/frontend/src/app/features/auth/header-user-menu/*`.
  - Login modal: `apps/frontend/src/app/features/auth/login-modal/*`.

## Playwright E2E Tests

- Navigation & session tests: `tests/e2e/navigation.spec.ts`.
- Tests assert that protected routes redirect unauthenticated users and that the login modal contains the health indicator in dev.

## How to test

```bash
curl -sS http://localhost:3000/api/__health
# -> { "ok": true }
```

## Notes

- Keep it minimal and consider proper instrumentation (readiness/liveness) for staging/production.
