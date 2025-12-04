# E2E Testing Guide

This directory contains end-to-end tests for the Harmonia application using Playwright.

## Quick Start

### 1. Install Playwright Browsers

```bash
# Install Playwright browsers (first time only)
npx playwright install
```

### 2. Setup Test Environment

```bash
# Create test database and seed admin user
pnpm test:e2e:setup
```

### 3. Ensure Servers Running

E2E tests require both frontend and backend servers to be running:

```bash
# Terminal 1: Start backend
pnpm dev:backend

# Terminal 2: Start frontend
pnpm dev:frontend
```

Or start both in parallel:

```bash
pnpm dev
```

**Note**: Playwright config will auto-start servers if not already running.

### 4. Run Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run auth tests only
pnpm test:e2e:auth

# Run with browser UI visible
pnpm test:e2e:headed

# Debug mode (step through)
pnpm test:e2e:debug

# Interactive UI mode
pnpm test:e2e:ui

# View last test report
pnpm test:e2e:report
```

## Test Structure

### Authentication Tests (`authentication.spec.ts`)

Comprehensive test suite covering all 10 authentication scenarios from `docs/TESTING_CHECKLIST.md`:

1. **User Registration Flow** - Sign up new user
2. **User Login Flow (Email)** - Login with email
3. **User Login Flow (Username)** - Login with username
4. **Protected Route Access** - Auth guard protection
5. **Admin Route Access** - Admin guard protection
6. **Logout Flow** - Logout and session cleanup
7. **Session Persistence** - Session survives page refresh
8. **Invalid Credentials Handling** - Error messages
9. **Network Error Handling** - Offline/timeout scenarios
10. **Token Refresh Flow** - Automatic token refresh

## Configuration

### Test Database

- **Database Name**: `harmonia_test`
- **Admin User**: `admin@harmonia.local` / `AdminP@ssw0rd!`
- **Test Users**: Auto-created during test execution (e.g., `e2e_test_user`)

### Environment Variables

Tests use the same `.env` file as development:

```bash
MONGO_ROOT_PASSWORD=<your-password>
MONGO_HARMONIA_PASSWORD=<your-password>
JWT_SECRET=<your-secret>
```

### Playwright Configuration

See `playwright.config.ts` for full configuration:

- **Base URL**: `http://localhost:4200`
- **Backend URL**: `http://localhost:3000`
- **Timeout**: 60 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Workers**: 1 (sequential execution for auth tests)
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On retry

## Writing New Tests

### Example Test Structure

```typescript
test('My new test', async ({ page }) => {
  // 1. Setup
  await page.goto('http://localhost:4200');
  
  // 2. Action
  await page.click('button:has-text("Login")');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // 3. Assertion
  await expect(page.locator('.user-menu')).toBeVisible();
});
```

### Helper Functions

Use provided helper functions in `authentication.spec.ts`:

- `loginUser(page, email, password)` - Login a user
- `logoutIfLoggedIn(page)` - Logout if currently logged in
- `registerUserIfNotExists(page, user)` - Register via API

## Troubleshooting

### Tests Failing Due to Timing Issues

Increase timeout for specific actions:

```typescript
await expect(element).toBeVisible({ timeout: 10000 }); // 10 seconds
```

### Servers Not Starting

If auto-start fails, manually start servers:

```bash
# Start servers in separate terminals
pnpm dev:backend
pnpm dev:frontend

# Then run tests with reuse flag
PWDEBUG=1 pnpm test:e2e
```

### Database Connection Issues

Ensure MongoDB is running:

```powershell
# Windows
Get-Service MongoDB

# If not running
net start MongoDB
```

### Clean Test Database

Reset test database:

```bash
pnpm test:e2e:setup
```

### View Test Results

```bash
# Open HTML report
pnpm test:e2e:report

# Results saved to: playwright-report/
```

## CI/CD Integration

Tests are configured for CI environments:

- Auto-retry failed tests (2 retries)
- Sequential execution (workers: 1)
- Screenshots/videos on failure
- HTML report artifact

### GitHub Actions Example

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Setup E2E Environment
  run: pnpm test:e2e:setup

- name: Run E2E Tests
  run: pnpm test:e2e

- name: Upload Test Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Use Data Attributes**: Prefer `[data-testid="..."]` selectors
3. **Wait for State**: Use `page.waitForLoadState('networkidle')`
4. **Clean Up**: Remove test data after test completion
5. **Descriptive Names**: Use clear test names from scenarios
6. **Screenshots**: Take screenshots of key states for debugging
7. **Parallel Safe**: Avoid shared state between tests

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Checklist](../docs/TESTING_CHECKLIST.md)
- [Authentication Implementation](../docs/AUTHENTICATION_SYSTEM.md)

---

**Last Updated**: December 3, 2025
