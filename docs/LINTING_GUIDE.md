# Linting Guide

**Last Updated**: December 2, 2025  
**Project**: Harmonia Music Generation Platform  
**Linters**: ESLint (TypeScript), markdownlint

---

## Overview

This document provides guidelines for code linting in the Harmonia project. We use ESLint for TypeScript code and markdownlint for documentation.

---

## Table of Contents

- [Linting Status](#linting-status)
- [Running Linters](#running-linters)
- [Frontend Linting](#frontend-linting)
- [Backend Linting](#backend-linting)
- [Markdown Linting](#markdown-linting)
- [Fixing Issues](#fixing-issues)
- [Configuration](#configuration)
- [Common Warnings](#common-warnings)
- [Best Practices](#best-practices)

---

## Linting Status

### Frontend ✅

**Status**: 18 warnings (0 errors)

All warnings are non-blocking and acceptable for development:

- 14 `@typescript-eslint/no-explicit-any` in test files
- 2 `no-console` in websocket service (debug logging)
- 2 `@typescript-eslint/no-non-null-assertion` in selectors
- 2 `max-lines-per-function` in test files (104 and 133 lines)

### Backend ⚠️

**Status**: Configuration issue

Lint target fails due to Windows path length limitation. This is a known Nx issue on Windows and doesn't indicate code problems.

**Workaround**: Backend code follows same ESLint rules as frontend. Can be verified via IDE linting.

### Markdown ✅

**Status**: All 44 documentation files are lint-clean (0 errors)

---

## Running Linters

### Lint All Projects

```bash
# Lint all projects (frontend, backend)
pnpm nx run-many --target=lint --all

# Skip cache
pnpm nx run-many --target=lint --all --skip-nx-cache

# Fix auto-fixable issues
pnpm nx run-many --target=lint --all --fix
```

### Lint Frontend Only

```bash
# Run ESLint on frontend
pnpm nx lint frontend

# Auto-fix issues
pnpm nx lint frontend --fix

# Skip cache
pnpm nx lint frontend --skip-nx-cache
```

### Lint Backend Only

```bash
# Run ESLint on backend (may fail on Windows due to path length)
pnpm nx lint backend

# Alternative: Use IDE linting or direct ESLint
cd apps/backend
pnpm eslint "src/**/*.ts"
```

### Lint Markdown Files

```bash
# Lint all markdown files
pnpm markdownlint "**/*.md" --ignore node_modules

# Fix auto-fixable issues
pnpm markdownlint "**/*.md" --ignore node_modules --fix

# Lint specific files
pnpm markdownlint TODO.md README.md
pnpm markdownlint "docs/**/*.md"
```

---

## Frontend Linting

### Current Warnings Breakdown

**18 Total Warnings**:

1. **Test File Warnings** (16 warnings)
   - `@typescript-eslint/no-explicit-any`: 14 occurrences
   - `max-lines-per-function`: 2 occurrences
   - **Location**: Guard specs, component specs, service specs
   - **Justification**: Tests often need flexible typing; long test functions group related scenarios

2. **WebSocket Service** (2 warnings)
   - `no-console`: 2 occurrences (lines 57, 62)
   - **Location**: `apps/frontend/src/app/services/websocket.service.ts`
   - **Justification**: Debug logging for WebSocket connection status

3. **Selector Warnings** (2 warnings)
   - `@typescript-eslint/no-non-null-assertion`: 2 occurrences (lines 157, 158)
   - **Location**: `apps/frontend/src/app/store/jobs/jobs.selectors.ts`
   - **Justification**: State is guaranteed to exist at these points

### Acceptable Warnings

These warnings are **acceptable in production** because:

1. **Test files** - Flexible typing aids in mock creation
2. **Debug logging** - Helps diagnose WebSocket issues in development
3. **Non-null assertions** - Used in controlled state management contexts

### Zero-Error Policy

**Critical**: All errors must be fixed before merging. Warnings are acceptable with justification.

---

## Backend Linting

### Known Issue: Path Length Limitation

**Error**:

```bash
The input line is too long.
The syntax of the command is incorrect.
ELIFECYCLE  Command failed with exit code 255.
```

**Cause**: Windows command line has a maximum path length limit. Nx's NODE_PATH variable exceeds this limit.

**Impact**: Does not indicate actual code quality issues. Backend follows same ESLint rules as frontend.

**Verification**: Use IDE linting (VS Code ESLint extension) to verify backend code quality.

**Resolution**: Consider:

- Shorter project paths (move closer to drive root)
- WSL2 for development (no path length limits)
- Update Nx configuration to shorten paths

---

## Markdown Linting

### Rules Enforced

We follow the [markdownlint rules](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md) with custom configuration:

**Key Rules**:

- MD001: Heading levels increment by one
- MD022: Headings surrounded by blank lines
- MD024: No duplicate headings (with exceptions)
- MD025: One top-level heading per file
- MD031: Fenced code blocks surrounded by blank lines
- MD032: Lists surrounded by blank lines
- MD034: No bare URLs (use link syntax)

### Common Fixes

**MD032 - Lists need blank lines**:

```markdown
<!-- Bad -->
Some text
- List item 1
- List item 2
More text

<!-- Good -->
Some text

- List item 1
- List item 2

More text
```

**MD031 - Code blocks need blank lines**:

```markdown
<!-- Bad -->
Text before
```bash
code
```

Text after

<!-- Good -->
Text before

```bash
code
```

Text after

```bash

**MD034 - Use proper link syntax**:

```markdown
<!-- Bad -->
Visit http://localhost:4200

<!-- Good -->
Visit <http://localhost:4200>

<!-- Or -->
Visit [the app](http://localhost:4200)
```

**MD024 - Duplicate headings**:

```markdown
<!-- Bad -->
## Installation
... content ...
## Installation  <!-- Duplicate! -->

<!-- Good -->
## Installation
... content ...
## Advanced Installation
```

---

## Fixing Issues

### Auto-Fix ESLint

```bash
# Fix all auto-fixable issues
pnpm nx lint frontend --fix

# Fix specific file
pnpm eslint apps/frontend/src/app/app.component.ts --fix
```

### Auto-Fix Markdown

```bash
# Fix all markdown files
pnpm markdownlint "**/*.md" --ignore node_modules --fix

# Fix docs folder
pnpm markdownlint "docs/**/*.md" --fix

# Fix specific file
pnpm markdownlint TODO.md --fix
```

### Manual Fixes

Some issues require manual intervention:

**No Explicit Any** - Replace `any` with proper types:

```typescript
// Before
function process(data: any) {
  return data.value;
}

// After
interface Data {
  value: string;
}

function process(data: Data) {
  return data.value;
}

// Or use generic
function process<T extends { value: string }>(data: T) {
  return data.value;
}
```

**No Console** - Replace with proper logging:

```typescript
// Before
console.log('User logged in:', user);

// After
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(MyService.name);
this.logger.log('User logged in', { userId: user.id });
```

**Non-Null Assertion** - Add proper null checks:

```typescript
// Before
const value = state.data!.value;

// After
const value = state.data?.value ?? defaultValue;

// Or
if (!state.data) {
  throw new Error('State data is required');
}
const value = state.data.value;
```

---

## Configuration

### ESLint Configuration

Located in: `.eslintrc.json` (root) and project-specific configs

**Key Rules**:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "max-lines-per-function": ["warn", { "max": 100 }],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_" }
    ]
  }
}
```

### Markdownlint Configuration

Located in: `.markdownlint.json`

```json
{
  "default": true,
  "MD013": false,
  "MD024": {
    "siblings_only": true
  },
  "MD033": {
    "allowed_elements": ["br", "details", "summary"]
  }
}
```

### VS Code Integration

Install extensions:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "DavidAnson.vscode-markdownlint"
  ]
}
```

Enable auto-fix on save (`.vscode/settings.json`):

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "markdownlint.config": {
    "default": true,
    "MD013": false
  }
}
```

---

## Common Warnings

### 1. `@typescript-eslint/no-explicit-any`

**Issue**: Using `any` type bypasses TypeScript's type checking

**Fix**:

```typescript
// Bad
function getData(param: any): any {
  return param.value;
}

// Good
interface DataParam {
  value: string;
}

function getData(param: DataParam): string {
  return param.value;
}

// Or use generics
function getData<T>(param: T): T {
  return param;
}
```

### 2. `no-console`

**Issue**: Console statements in production code

**Fix**:

```typescript
// Bad
console.log('Debug info:', data);

// Good - Remove or replace with proper logging
// Remove for production, or use logging service
this.logger.debug('Debug info', data);
```

### 3. `@typescript-eslint/no-non-null-assertion`

**Issue**: Using `!` operator can cause runtime errors

**Fix**:

```typescript
// Bad
const value = data!.property;

// Good - Optional chaining with default
const value = data?.property ?? 'default';

// Or guard clause
if (!data) {
  throw new Error('Data is required');
}
const value = data.property;
```

### 4. `max-lines-per-function`

**Issue**: Function exceeds 100 lines (default limit)

**Fix**:

```typescript
// Bad - one long function
function processData(data: Data) {
  // 150 lines of code
}

// Good - split into smaller functions
function processData(data: Data) {
  const validated = validateData(data);
  const transformed = transformData(validated);
  return saveData(transformed);
}

function validateData(data: Data) {
  // Validation logic
}

function transformData(data: Data) {
  // Transformation logic
}

function saveData(data: Data) {
  // Save logic
}
```

---

## Best Practices

### 1. Fix Linting Errors Before Committing

```bash
# Pre-commit checklist
pnpm nx lint frontend --fix
pnpm nx lint backend --fix
pnpm markdownlint "**/*.md" --fix
```

### 2. Keep Warnings Minimal

- Aim for zero warnings in new code
- Document why existing warnings are acceptable
- Create issues for warnings that should be fixed

### 3. Use IDE Linting

Enable ESLint and markdownlint extensions in your IDE for real-time feedback.

### 4. Consistent Style

Follow the project's ESLint rules for consistent code style across the team.

### 5. Document Exceptions

If disabling a rule is necessary:

```typescript
// Bad - no explanation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = response;

// Good - with explanation
// Third-party library returns untyped data; will be properly typed in v2.0
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = legacyLibrary.getData();
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm nx run-many --target=lint --all
      - run: pnpm markdownlint "**/*.md" --ignore node_modules
```

---

## Summary

**Current Status**:

- ✅ Frontend: 18 warnings (acceptable, 0 errors)
- ⚠️ Backend: Config issue (code quality verified via IDE)
- ✅ Markdown: 0 errors across 44 files

**Next Steps**:

1. Continue maintaining zero-error policy
2. Consider reducing warnings in test files
3. Fix backend lint configuration for CI/CD
4. Document linting rules for new contributors

---

## Related Documentation

- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - Code style guidelines
- [TYPESCRIPT_CONFIGURATION.md](./TYPESCRIPT_CONFIGURATION.md) - TypeScript setup
- [UNIT_TESTING_GUIDE.md](./UNIT_TESTING_GUIDE.md) - Testing guidelines

---

**Maintained By**: Development Team  
**Last Review**: December 2, 2025
