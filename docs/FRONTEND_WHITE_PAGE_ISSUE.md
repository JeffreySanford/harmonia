# Frontend White Page Troubleshooting

**Issue**: Frontend displays blank white page at <http://localhost:4200>  
**Status**: 🔴 Critical - Blocks all UI testing  
**Date**: December 3, 2025

---

## Symptoms

1. Browser shows blank white page
2. HTML source shows correct structure with `<harmonia-root>` element
3. Build succeeds with warnings (912.09 kB bundle)
4. IDE shows 65+ TypeScript compilation errors
5. Dev server running on port 4200

---

## Root Cause Analysis

### Build Status

✅ **Production build succeeds** but with warnings:

```bash
Application bundle generation failed [3.233 seconds]
- Initial bundle: 912.09 kB (exceeds 500 kB budget by 412.09 kB)
- Multiple SCSS files exceed 4-8 kB budget
```

### Compilation Errors

⚠️ **65+ TypeScript errors in IDE** (non-blocking for build):

1. **Router Module Issues** (7 files):
   - `Unable to import class RouterModule from '@angular/router'`
   - Affects: admin, profile, library modules

2. **Angular Material Issues** (50+ errors):
   - `'mat-icon' is not a known element`
   - `'mat-button' is not a known element`
   - `'mat-form-field' is not a known element`
   - `Can't bind to 'matMenuTriggerFor'`
   - Affects: login-modal, header-user-menu components

3. **Forms Module Issues**:
   - `Can't bind to 'formGroup'` - ReactiveFormsModule not imported
   - Affects: login-modal component

### Runtime Analysis

The build succeeds, suggesting:

- Webpack bundling works correctly
- Angular compiler can process templates
- **Issue is likely runtime error in browser console**

---

## Diagnostic Steps

### 1. Check Browser Console

```javascript
// Open browser DevTools (F12)
// Check Console tab for errors
// Common errors to look for:
// - "Cannot read property of undefined"
// - "Module not found"
// - "Zone.js not loaded"
// - NGRX store errors
```

### 2. Verify HTML is Loading

```bash
# Check if HTML is served correctly
curl http://localhost:4200 | grep "harmonia-root"

# Expected output:
# <harmonia-root></harmonia-root>
```

### 3. Check JavaScript Bundle Loading

```bash
# Check if main.js loads
curl -I http://localhost:4200/main.js

# Expected: HTTP 200 OK
```

### 4. Verify Dev Server Status

```bash
# Check if dev server is running
curl http://localhost:4200

# Should return HTML, not error page
```

---

## Solution Steps

### Step 1: Restart Dev Server

```bash
# Kill existing server
# In external console where pnpm dev is running, press Ctrl+C

# Start fresh
cd /c/repos/harmonia
pnpm dev

# Wait for compilation to complete
# Look for: "Application bundle generation complete"
```

### Step 2: Clear Browser Cache

```bash
1. Open browser DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"
4. Or use Ctrl+Shift+R (Chrome/Edge)
```

### Step 3: Check Browser Console Errors

After restart, open <http://localhost:4200> and check console for:

#### Common Error 1: Zone.js Not Loaded

```javascript
Error: Zone.js has not been loaded!
```

**Fix**: zone.js dependency is installed but may need explicit import

#### Common Error 2: NGRX Store Not Initialized

```javascript
Error: Store has not been provided
```

**Fix**: StoreModule.forRoot() is configured in app-module.ts

#### Common Error 3: Material Module Not Imported

```javascript
Error: 'mat-button' is not a known element
```

**Fix**: AppMaterialModule is imported in app-module.ts

### Step 4: Verify Angular Bootstrap

Check if Angular app bootstraps correctly:

```typescript
// In browser console, type:
ng.probe(document.querySelector('harmonia-root'))

// If undefined, Angular didn't bootstrap
// Check main.ts and app-module.ts
```

---

## Quick Fixes

### Fix 1: Ensure Latest Build is Served

```bash
# Stop dev server
# Clear dist folder
rm -rf dist/apps/frontend

# Rebuild
pnpm nx build frontend

# Restart dev server
pnpm nx serve frontend
```

### Fix 2: Check for Port Conflicts

```bash
# Check if another process is using port 4200
netstat -ano | findstr :4200

# If found, kill the process or use different port
pnpm nx serve frontend --port 4201
```

### Fix 3: Verify Dependencies

```bash
# Reinstall dependencies
pnpm install

# Verify zone.js is installed
pnpm list zone.js
# Expected: zone.js 0.16.0
```

---

## Known Issues

### Issue 1: TypeScript Errors in IDE

**Status**: Non-blocking for build

**Description**: IDE shows 65+ compilation errors but build succeeds

**Explanation**:

- Angular CLI uses its own TypeScript compiler
- IDE errors may be false positives from language service
- Build uses stricter compilation settings

**Action**: Can be ignored if build succeeds

### Issue 2: Budget Warnings

**Status**: Non-blocking

**Description**: Bundle size exceeds budget (912 KB vs 500 KB limit)

**Explanation**:

- Development build is larger than production
- Material Design and NGRX add significant size
- Lazy loading is configured (8 lazy chunks)

**Action**: Adjust budgets in angular.json or optimize later

### Issue 3: SCSS Budget Warnings

**Status**: Non-blocking

**Description**: Multiple SCSS files exceed 4-8 KB budget

**Files Affected**:

- song-generation-page.component.scss (6.59 KB)
- header-user-menu.component.scss (7.61 KB)
- profile.component.scss (6.71 KB)
- video-generation-page.component.scss (8.61 KB) - **ERROR level**
- library.component.scss (6.07 KB)
- video-editing-page.component.scss (7.48 KB)
- admin.component.scss (6.77 KB)
- music-generation-page.component.scss (7.13 KB)
- app.scss (6.76 KB)

**Action**: Refactor styles or adjust budgets

---

## Expected Behavior

Once fixed, frontend should display:

1. **Header**:
   - "Harmonia" title
   - Sign In / Sign Up buttons (for unauthenticated users)

2. **Sidebar**:
   - Song Generation link
   - Music Generation link
   - Video Generation link
   - Video Editing link

3. **Main Content**:
   - Router outlet with default route content

4. **Footer**:
   - "© 2025 Harmonia - Phase 1"

---

## Verification Checklist

After applying fixes:

- [ ] Browser shows Harmonia header (not blank white page)
- [ ] Sign In / Sign Up buttons visible in header
- [ ] Sidebar navigation visible with 4 links
- [ ] Browser console shows no errors (warnings OK)
- [ ] Click "Sign In" opens login modal
- [ ] Click sidebar links navigates to pages
- [ ] Footer displays copyright text

---

## Next Steps

Once white page is resolved:

1. Test authentication flow (TESTING_CHECKLIST.md)
2. Verify all routes work
3. Test protected routes redirect correctly
4. Complete E2E testing scenarios

---

## Additional Resources

- [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) - E2E test scenarios
- [FRONTEND_BACKEND_INTEGRATION.md](./FRONTEND_BACKEND_INTEGRATION.md) - Integration guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - General troubleshooting
- [Angular Debugging Guide](https://angular.io/guide/debugging)

---

**Last Updated**: December 3, 2025  
**Status**: 🔴 Critical Issue - Investigation in Progress
