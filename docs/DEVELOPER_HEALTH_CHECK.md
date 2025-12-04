# Developer Health Check (Dev Only)

This short guide documents the development-only health check used to verify backend reachability from the UI.

> ⚠️ Dev-only: only enabled locally (localhost/127.0.0.1). Not intended for production.

## Purpose

- Provide a tiny `GET /api/__health` endpoint used by the frontend for a quick reachability indicator.
- Useful for development UX; not intended as a production readiness check.

## Endpoint

- Route: `GET /api/__health`
- Response: `200 OK` JSON `{ "ok": true }`

## Backend

- Implemented in: `apps/backend/src/health/health.controller.ts`
- Registered in: `apps/backend/src/app/app.module.ts`

## Frontend

- `apps/frontend/src/app/services/health.service.ts` exposes `isBackendReachable()` returning an `Observable<boolean>`.
- UI indicators:
  - Header: `apps/frontend/src/app/features/auth/header-user-menu/*`
  - Login modal: `apps/frontend/src/app/features/auth/login-modal/*`

## E2E Tests

- Playwright tests available in `tests/e2e/navigation.spec.ts` validate redirect behavior and presence of health indicator.

## Testing

```bash
curl -sS http://localhost:3000/api/__health
# -> { "ok": true }
```

## Notes

- Keep this endpoint minimal and consider removing or restricting it in non-local environments.
