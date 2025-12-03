# Authentication Testing Checklist

**Status**: Ready for Testing (Blocked by Angular version issue)  
**Date**: December 3, 2025  
**Component**: Full-Stack Authentication System

---

## Prerequisites

### Fix Angular Version Issue

```bash
# Current Error:
# Error: The current version of "@angular/build" supports Angular versions ^20.0.0,
# but detected Angular version 21.0.2 instead.

# Option 1: Update @angular/build
pnpm update @angular/build

# Option 2: Check for Angular compatibility
pnpm nx migrate latest

# See: https://update.angular.dev/
```

### Start Servers

**Backend** (should already be running):

```bash
pnpm nx serve backend
# Running on http://localhost:3000
```

**Frontend** (after Angular fix):

```bash
pnpm nx serve frontend
# Will run on http://localhost:4200
```

### Test User Credentials

**Pre-created user**:

- **Email**: `admin@harmonia.com`
- **Username**: admin
- **Password**: Admin123456

---

## Test Suite

### 1. Registration Flow

**URL**: `http://localhost:4200`

**Steps**:

1. [ ] Click "Sign Up" button in header
2. [ ] Modal opens with registration form
3. [ ] Fill form:
   - Email: `newuser@test.com`
   - Username: `newuser`
   - Password: `TestPass123`
4. [ ] Click "Create Account"
5. [ ] Verify loading spinner appears
6. [ ] Wait for response

**Expected Results**:

- [ ] Modal closes automatically
- [ ] Header shows user menu with "newuser" username
- [ ] Redirected to `/library` page
- [ ] Browser localStorage contains:
  - `auth_token` (JWT access token)
  - `refresh_token` (JWT refresh token)
- [ ] Browser Network tab shows:
  - POST `http://localhost:3000/api/auth/register` → 201 Created
  - Response body contains `user`, `accessToken`, `refreshToken`

**Error Cases to Test**:

- [ ] Empty fields → Form validation prevents submission
- [ ] Invalid email format → Error message displayed
- [ ] Password < 8 chars → Error message displayed
- [ ] Username < 3 chars → Error message displayed
- [ ] Duplicate email → 409 Conflict error displayed in modal
- [ ] Duplicate username → 409 Conflict error displayed in modal

---

### 2. Login Flow

**URL**: `http://localhost:4200`

**Steps**:

1. [ ] If logged in, click user menu → Logout
2. [ ] Click "Sign In" button in header
3. [ ] Modal opens with login form
4. [ ] Test login with **username**:
   - Email or Username: `admin`
   - Password: `Admin123456`
5. [ ] Click "Sign In"
6. [ ] Verify loading spinner appears
7. [ ] Wait for response

**Expected Results**:

- [ ] Modal closes automatically
- [ ] Header shows user menu with "admin" username
- [ ] Redirected to `/library` page
- [ ] Browser localStorage contains JWT tokens
- [ ] Browser Network tab shows:
  - POST `http://localhost:3000/api/auth/login` → 200 OK
  - Response body contains `user`, `accessToken`, `refreshToken`, `expiresIn: 900`

**Test with Email**:

1. [ ] Logout and login again
2. [ ] Use email instead of username:
   - Email or Username: `admin@harmonia.com`
   - Password: `Admin123456`
3. [ ] Should work identically

**Error Cases to Test**:

- [ ] Empty fields → Form validation prevents submission
- [ ] Wrong password → 401 Unauthorized error displayed
- [ ] Non-existent username → 401 Unauthorized error displayed
- [ ] Backend down → Network error handled gracefully

---

### 3. Protected Routes

**URL**: `http://localhost:4200`

**Steps (While Logged In)**:

1. [ ] Navigate to `/library`
   - **Expected**: Page loads successfully
2. [ ] Navigate to `/profile`
   - **Expected**: Page loads successfully
3. [ ] Navigate to `/admin`
   - **Expected**: Redirected to `/` (non-admin user)
4. [ ] Check browser Network tab for any requests to `/library` or `/profile`
   - **Expected**: All requests include `Authorization: Bearer <token>` header

**Steps (While Logged Out)**:

1. [ ] Click user menu → Logout
2. [ ] Manually navigate to `/library` via URL bar
   - **Expected**: Redirected to `/` (home page)
3. [ ] Manually navigate to `/profile` via URL bar
   - **Expected**: Redirected to `/` (home page)
4. [ ] Navigate to `/` (home page)
   - **Expected**: Loads successfully (public route)

**Guest Guard Test**:

1. [ ] While logged in, navigate to home `/`
   - **Expected**: Should load (no guestGuard applied to home in current implementation)
   - **Note**: If guestGuard is applied, should redirect to `/library`

---

### 4. Session Validation

**URL**: `http://localhost:4200`

**Steps**:

1. [ ] Login as `admin`
2. [ ] Open browser DevTools → Application → Local Storage
3. [ ] Copy the `auth_token` value
4. [ ] Open browser DevTools → Network tab
5. [ ] Filter requests to `session`
6. [ ] Refresh the page
7. [ ] Find GET request to `http://localhost:3000/api/auth/session`

**Expected Results**:

- [ ] Request includes `Authorization: Bearer <token>` header
- [ ] Response status: 200 OK
- [ ] Response body contains:

  ```json
  {
    "id": "...",
    "email": "admin@harmonia.com",
    "username": "admin",
    "role": "user"
  }
  ```

**Session Invalid Test**:

1. [ ] In DevTools Local Storage, delete `auth_token`
2. [ ] Navigate to `/library`
3. [ ] **Expected**: Redirected to `/` (authGuard blocks)

---

### 5. Logout Flow

**URL**: `http://localhost:4200`

**Steps**:

1. [ ] Login as any user
2. [ ] Click user menu in header (top-right)
3. [ ] Menu dropdown appears with options
4. [ ] Click "Logout"

**Expected Results**:

- [ ] User menu disappears from header
- [ ] "Sign In" button reappears in header
- [ ] Redirected to `/` (home page)
- [ ] Browser localStorage cleared:
  - `auth_token` removed
  - `refresh_token` removed
- [ ] Browser Network tab shows:
  - POST `http://localhost:3000/api/auth/logout` → 200 OK
  - Response body: `{ "message": "Logged out successfully", "success": true }`

**Post-Logout Verification**:

1. [ ] Try navigating to `/library`
   - **Expected**: Redirected to `/` (authGuard blocks)
2. [ ] Click "Sign In" and login again
   - **Expected**: Works normally

---

### 6. Token Refresh (Advanced)

**URL**: `http://localhost:4200`

**Setup**:

1. [ ] Login as any user
2. [ ] Open browser DevTools → Console
3. [ ] Run:

   ```javascript
   // Get current token
   const token = localStorage.getItem('auth_token');
   console.log('Current token:', token);
   
   // Decode JWT (copy token to jwt.io)
   // Verify 'exp' claim (expiration timestamp)
   ```

**Steps**:

1. [ ] Wait 15 minutes (access token expiration)
2. [ ] Perform any action that requires auth (navigate to `/library`)
3. [ ] Check browser Network tab

**Expected Results** (if auto-refresh implemented):

- [ ] First request fails with 401
- [ ] AuthInterceptor catches 401
- [ ] POST `http://localhost:3000/api/auth/refresh` is called
- [ ] New tokens received
- [ ] Original request retried with new token
- [ ] User remains logged in

**Expected Results** (if auto-refresh NOT implemented):

- [ ] First request fails with 401
- [ ] User logged out automatically
- [ ] Redirected to `/` (home page)
- [ ] "Sign In" button reappears

---

### 7. HTTP Interceptor

**URL**: `http://localhost:4200`

**Steps**:

1. [ ] Login as any user
2. [ ] Open browser DevTools → Network tab
3. [ ] Clear network log
4. [ ] Navigate to `/library`
5. [ ] Inspect any API requests to backend

**Expected Results**:

- [ ] All requests to `http://localhost:3000/api/*` include:
  - `Authorization: Bearer <access_token>` header
- [ ] Requests to `/auth/login`, `/auth/register`, `/auth/refresh` do NOT include auth header
- [ ] Other requests (future endpoints like `/api/library`) include auth header

**401 Error Handling**:

1. [ ] In DevTools Local Storage, corrupt the `auth_token` value
2. [ ] Navigate to `/library`
3. [ ] Check Network tab

**Expected Results**:

- [ ] Request to `/api/auth/session` returns 401
- [ ] AuthInterceptor catches error
- [ ] User logged out automatically
- [ ] Redirected to `/` (home page)

---

### 8. User Menu Functionality

**URL**: `http://localhost:4200`

**Steps**:

1. [ ] Login as any user
2. [ ] Click user menu in header (shows username + avatar/icon)
3. [ ] Dropdown menu opens

**Expected Menu Items**:

- [ ] Username display (e.g., "admin")
- [ ] Email display (e.g., `admin@harmonia.com`)
- [ ] "My Library" button → navigates to `/library`
- [ ] "Profile" button → navigates to `/profile`
- [ ] "Admin Dashboard" button (only if admin role) → navigates to `/admin`
- [ ] Divider
- [ ] "Logout" button → logs out user

**Admin Role Test**:

1. [ ] Login as admin (username: `admin`)
2. [ ] Open user menu
3. [ ] **Expected**: "Admin Dashboard" option visible
4. [ ] Logout
5. [ ] Register new user (non-admin)
6. [ ] Open user menu
7. [ ] **Expected**: "Admin Dashboard" option NOT visible

---

### 9. Form Validation

**URL**: `http://localhost:4200`

**Login Form**:

1. [ ] Open login modal
2. [ ] Click "Sign In" without filling form
   - **Expected**: Both fields show "required" error
3. [ ] Enter text in password field, then clear it
   - **Expected**: "Password is required" error appears
4. [ ] Enter short password (< 8 chars)
   - **Expected**: "Password must be at least 8 characters" error

**Register Form**:

1. [ ] Open login modal → click "Sign Up"
2. [ ] Click "Create Account" without filling form
   - **Expected**: All fields show "required" error
3. [ ] Enter invalid email (e.g., "notanemail")
   - **Expected**: "Please enter a valid email address" error
4. [ ] Enter short username (< 3 chars)
   - **Expected**: "Username must be at least 3 characters" error
5. [ ] Enter long username (> 20 chars)
   - **Expected**: "Username must be no more than 20 characters" error
6. [ ] Enter short password (< 8 chars)
   - **Expected**: "Password must be at least 8 characters" error

---

### 10. Navigation & Routing

**URL**: `http://localhost:4200`

**Public Routes**:

1. [ ] Navigate to `/` (home page)
   - **Expected**: Loads without redirect
2. [ ] Navigate to non-existent route (e.g., `/does-not-exist`)
   - **Expected**: 404 page or redirect to home

**Protected Routes (Not Logged In)**:

1. [ ] Logout if logged in
2. [ ] Navigate to `/library`
   - **Expected**: Redirect to `/`
3. [ ] Navigate to `/profile`
   - **Expected**: Redirect to `/`
4. [ ] Navigate to `/admin`
   - **Expected**: Redirect to `/`

**Protected Routes (Logged In)**:

1. [ ] Login as admin
2. [ ] Navigate to `/library`
   - **Expected**: Loads successfully (placeholder page)
3. [ ] Navigate to `/profile`
   - **Expected**: Loads successfully (placeholder page)
4. [ ] Navigate to `/admin`
   - **Expected**: Loads successfully (placeholder page) OR redirects if not admin

**URL Bar Navigation**:

1. [ ] Manually type `/library` in URL bar
   - **Expected**: Works same as clicking link

---

## Browser Compatibility

Test in multiple browsers:

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on macOS)

---

## Performance Checks

1. [ ] Login modal opens quickly (< 200ms)
2. [ ] Login request completes quickly (< 500ms)
3. [ ] Navigation between routes is smooth
4. [ ] No console errors in DevTools
5. [ ] Network tab shows no failed requests (except intentional error tests)

---

## Security Checks

1. [ ] JWT tokens stored in localStorage (visible in DevTools → Application)
2. [ ] Passwords not visible in Network tab (POST body should be plain text, backend handles hashing)
3. [ ] JWT tokens included in request headers (not in URL or body)
4. [ ] 401 responses correctly clear auth state
5. [ ] Protected routes not accessible without auth

---

## Known Issues / Blockers

### Angular Version Mismatch

**Error**:

```text
Error: The current version of "@angular/build" supports Angular versions ^20.0.0,
but detected Angular version 21.0.2 instead.
```

**Resolution**: Update Angular or @angular/build to compatible versions

**Impact**: Frontend cannot serve, blocking all UI tests

---

## Success Criteria Summary

- [ ] **Registration**: User can create account, receives tokens, redirected to `/library`
- [ ] **Login**: User can login with username OR email, redirected to `/library`
- [ ] **Session**: Tokens stored in localStorage, requests include auth headers
- [ ] **Protected Routes**: `/library`, `/profile` require authentication
- [ ] **Admin Routes**: `/admin` requires admin role (or blocks non-admin)
- [ ] **Logout**: Clears tokens, redirects to `/`, shows "Sign In" button
- [ ] **User Menu**: Shows username, navigation options, logout
- [ ] **Error Handling**: Invalid credentials, network errors handled gracefully
- [ ] **Form Validation**: All fields validated, errors displayed
- [ ] **Zero Console Errors**: No errors in browser console during normal flow

---

## Next Steps After Testing

1. **Fix any bugs found** during testing
2. **Implement auto token refresh** (optional, enhances UX)
3. **Add error notifications** (Snackbar/Toast for better UX)
4. **Implement password strength indicator** (nice-to-have)
5. **Add loading states** to all buttons (already done for login/register)
6. **Move to Sprint 3**: User Library feature implementation

---

**Last Updated**: December 3, 2025  
**Related Docs**:

- `FRONTEND_BACKEND_INTEGRATION.md` - Integration details
- `AUTHENTICATION_SYSTEM.md` - Auth architecture
- `TODO.md` - Project task tracking
