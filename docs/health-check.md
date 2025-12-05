# Developer Health Check (Dev-Only)

This guide documents the development-only health check endpoint used to verify backend reachability from the frontend UI.

> ⚠️ **Dev-only**: Only enabled for local development (localhost/127.0.0.1) and not intended for production or public environments.

## Purpose

- Provide a minimal `GET /api/__health` endpoint for quick backend reachability verification
- Frontend displays development-only health indicators in the UI (header and login modal)
- Useful for development UX; not intended as a production readiness check

## Endpoint

- **Route**: `GET /api/__health`
- **Response**: `200 OK` JSON: `{ "ok": true }`
- **Method**: HTTP GET
- **Authentication**: None required (dev-only endpoint)

## Backend Implementation

- **Controller**: `apps/backend/src/health/health.controller.ts`
- **Module Registration**: `apps/backend/src/app/app.module.ts`
- **Response Format**: Simple JSON status indicator

## Frontend Implementation

- **Service**: `apps/frontend/src/app/services/health.service.ts`
  - Method: `isBackendReachable()` returns `Observable<boolean>`
- **UI Indicators** (Dev-only):
  - **Header**: `apps/frontend/src/app/features/auth/header-user-menu/*`
  - **Login Modal**: `apps/frontend/src/app/features/auth/login-modal/*`

## Testing

### Manual Testing

```bash
curl -sS http://localhost:3000/api/__health
# Expected response: { "ok": true }
```

### E2E Tests

- **Test File**: `tests/e2e/navigation.spec.ts`
- **Coverage**:
  - Navigation and session validation tests
  - Protected route redirects for unauthenticated users
  - Health indicator presence in login modal during development

## Security Considerations

- **Environment Restriction**: Only enabled on localhost/127.0.0.1
- **Production**: Should be disabled or restricted in production environments
- **Minimal Surface**: Keep endpoint functionality minimal to reduce attack surface

## Future Considerations

- Consider implementing proper health checks for production (readiness/liveness probes)
- Add more comprehensive health metrics if needed for staging/production monitoring
- Evaluate instrumentation requirements for container orchestration platforms

## Notes

- Keep this endpoint minimal and focused on development reachability
- Consider removing or restricting access in non-local environments
- Not suitable for production health monitoring or load balancer checks
