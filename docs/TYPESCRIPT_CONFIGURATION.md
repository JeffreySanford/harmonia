# TypeScript Configuration Guide

## Overview

Harmonia uses a comprehensive TypeScript configuration strategy that enforces maximum type safety while optimizing for both Angular and NestJS platforms. This guide explains the configuration hierarchy and settings.

---

## Configuration Hierarchy

```text
tsconfig.json (root)
├── apps/frontend/tsconfig.json (Angular base)
│   ├── apps/frontend/tsconfig.app.json (production)
│   └── apps/frontend/tsconfig.spec.json (testing)
└── apps/backend/tsconfig.json (NestJS base)
    ├── apps/backend/tsconfig.app.json (production)
    └── apps/backend/tsconfig.spec.json (testing)
```

---

## Root Configuration (`tsconfig.json`)

### Key Features

**Language & Environment:**

- `target: ES2022` - Modern JavaScript features
- `lib: ES2022` - Standard library support
- `module: ESNext` - Latest module system
- `moduleResolution: bundler` - Modern bundler resolution

**Strict Type Checking (Maximum Safety):**

- `strict: true` - Enable all strict checks
- `noImplicitAny: true` - No implicit any types
- `strictNullChecks: true` - Strict null/undefined checks
- `noUnusedLocals: true` - Detect unused local variables
- `noUnusedParameters: true` - Detect unused function parameters
- `noImplicitReturns: true` - All code paths must return value
- `noFallthroughCasesInSwitch: true` - Prevent switch fallthrough bugs
- `noUncheckedIndexedAccess: true` - Index access returns `T | undefined`
- `noImplicitOverride: true` - Explicit override keyword required

**Decorators:**

- `experimentalDecorators: true` - Enable decorators for Angular/NestJS
- `emitDecoratorMetadata: true` - Emit metadata for dependency injection

**Output:**

- `declaration: true` - Generate .d.ts files
- `declarationMap: true` - Source maps for declarations
- `sourceMap: true` - Debug support
- `importHelpers: true` - Use tslib for smaller bundles

---

## Frontend Configuration (Angular 20)

### Base (`apps/frontend/tsconfig.json`)

**Angular-Specific Overrides:**

- `module: ES2022` - Angular uses ES modules
- `moduleResolution: bundler` - Angular CLI bundler
- `lib: ["ES2022", "dom"]` - DOM types included
- `useDefineForClassFields: false` - Angular decorator compatibility

**Path Mapping for Clean Imports:**

```typescript
// Instead of: import { AuthService } from '../../../services/auth.service';
// Use: import { AuthService } from '@app/services/auth.service';

"paths": {
  "@app/*": ["src/app/*"],
  "@environments/*": ["src/environments/*"],
  "@styles/*": ["src/styles/*"]
}
```

**Angular Compiler Options (Strict Templates):**

- `strictTemplates: true` - Full template type checking
- `strictInjectionParameters: true` - Strict DI type checking
- `strictInputAccessModifiers: true` - Enforce input/output modifiers
- `strictNullInputTypes: true` - No nullable inputs without `| null`
- `strictDomLocalRefTypes: true` - Template reference type checking
- `strictContextGenerics: true` - Generic component type checking
- `enableBlockSyntax: true` - Angular 18+ @if/@for syntax
- `enableLetSyntax: true` - Template @let declarations

### App Configuration (`tsconfig.app.json`)

**Production Build Settings:**

- `types: []` - No global type pollution
- `include: ["src/**/*.ts"]` - All source files
- `files: ["src/main.ts"]` - Explicit entry point
- Excludes test files and stories

### Test Configuration (`tsconfig.spec.json`)

**Jest-Specific Settings:**

- `module: commonjs` - Jest uses CommonJS
- `moduleResolution: node` - Node resolution for tests
- `types: ["jest", "node"]` - Jest type definitions
- `isolatedModules: false` - Allow test-specific imports
- Includes test setup and all spec files

---

## Backend Configuration (NestJS 11)

### Base (`apps/backend/tsconfig.json`)

**NestJS-Specific Settings:**

- `module: commonjs` - Node.js uses CommonJS
- `target: ES2022` - Modern Node.js LTS features
- `moduleResolution: node` - Standard Node resolution
- `emitDecoratorMetadata: true` - Critical for NestJS DI

**Path Mapping for Clean Imports:**

```typescript
// Instead of: import { UsersService } from '../../../users/users.service';
// Use: import { UsersService } from '@app/users/users.service';

"paths": {
  "@app/*": ["src/app/*"],
  "@config/*": ["src/config/*"],
  "@common/*": ["src/common/*"]
}
```

**Relaxed Settings for NestJS:**

- `strictPropertyInitialization: false` - NestJS DI initializes properties

### Backend App Configuration (`tsconfig.app.json`)

**Production Build Settings:**

- `types: ["node"]` - Only Node.js types
- `removeComments: true` - Smaller production bundles
- `declaration: true` - Generate type definitions
- `declarationMap: true` - Debug support for libraries
- `files: ["src/main.ts"]` - Explicit entry point

### Backend Test Configuration (`tsconfig.spec.json`)

**Jest-Specific Settings:**

- Same as frontend tests
- Relaxed `strictPropertyInitialization` for mocking
- Relaxed `noUnusedLocals/Parameters` for test helpers

---

## Strict Type Checking Benefits

### 1. Catch Bugs at Compile Time

**Before (`noUncheckedIndexedAccess: false`):**

```typescript
const users = ['Alice', 'Bob'];
const user = users[5]; // string (runtime error)
console.log(user.toUpperCase()); // Crashes!
```

**After (`noUncheckedIndexedAccess: true`):**

```typescript
const users = ['Alice', 'Bob'];
const user = users[5]; // string | undefined
console.log(user?.toUpperCase()); // Safe!
```

### 2. Prevent Implicit Any

**Before (`noImplicitAny: false`):**

```typescript
function process(data) {
  // any - no type safety
  return data.value; // No autocomplete, no checks
}
```

**After (`noImplicitAny: true`):**

```typescript
function process(data: { value: string }) {
  return data.value; // Fully typed, autocomplete works
}
```

### 3. Enforce Return Types

**Before (`noImplicitReturns: false`):**

```typescript
function getStatus(id: number): string {
  if (id > 0) {
    return 'active';
  }
  // Missing return - runtime undefined!
}
```

**After (`noImplicitReturns: true`):**

```typescript
function getStatus(id: number): string {
  if (id > 0) {
    return 'active';
  }
  return 'inactive'; // Compiler enforces all paths return
}
```

### 4. Strict Null Checks

**Before (`strictNullChecks: false`):**

```typescript
function greet(name: string | null) {
  console.log(name.toUpperCase()); // Crashes if null!
}
```

**After (`strictNullChecks: true`):**

```typescript
function greet(name: string | null) {
  if (name) {
    console.log(name.toUpperCase()); // Type narrowed to string
  }
}
```

---

## Path Mapping Usage

### Frontend (Angular)

```typescript
// ❌ Bad: Relative imports
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { API_URL } from '../../../environments/environment';

// ✅ Good: Path mapped imports
import { AuthService } from '@app/services/auth.service';
import { User } from '@app/models/user.model';
import { API_URL } from '@environments/environment';
```

### Backend (NestJS)

```typescript
// ❌ Bad: Relative imports
import { UsersService } from '../../../users/users.service';
import { DatabaseConfig } from '../../../config/database.config';
import { LoggerMiddleware } from '../../../common/middleware/logger.middleware';

// ✅ Good: Path mapped imports
import { UsersService } from '@app/users/users.service';
import { DatabaseConfig } from '@config/database.config';
import { LoggerMiddleware } from '@common/middleware/logger.middleware';
```

---

## Angular Strict Template Checking

### What It Catches

**Strict Input Types:**

```typescript
@Component({
  /* ... */
})
export class UserCard {
  @Input() user!: User; // Not nullable
}
```

```html
<!-- ❌ Error: Type 'null' is not assignable to type 'User' -->
<app-user-card [user]="null"></app-user-card>

<!-- ✅ Correct: -->
<app-user-card [user]="currentUser"></app-user-card>
```

**Strict Output Types:**

```typescript
@Component({
  /* ... */
})
export class SearchBox {
  @Output() search = new EventEmitter<string>();
}
```

```html
<!-- ❌ Error: Expected string, got number -->
<app-search-box (search)="onSearch($event.length)"></app-search-box>

<!-- ✅ Correct: -->
<app-search-box (search)="onSearch($event)"></app-search-box>
```

**Template Reference Types:**

```html
<!-- ❌ Error: Property 'focus' does not exist on type 'HTMLElement' -->
<input #nameInput />
<button (click)="nameInput.focus()">Focus</button>

<!-- ✅ Correct: -->
<input #nameInput />
<button (click)="nameInput.focus()">Focus</button>
```

---

## Decorator Metadata

### Required for Dependency Injection

**Angular:**

```typescript
@Injectable()
export class AuthService {
  constructor(
    private http: HttpClient, // Metadata emitted for DI
    private router: Router
  ) {}
}
```

**NestJS:**

```typescript
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>, // Metadata for DI
    private configService: ConfigService
  ) {}
}
```

Without `emitDecoratorMetadata: true`, dependency injection fails at runtime.

---

## Common Issues & Solutions

### Issue 1: "Cannot find module '@app/...'"

**Cause:** Path mappings not configured in IDE

**Solution:** Restart TypeScript server

- VS Code: Ctrl+Shift+P → "TypeScript: Restart TS Server"
- Or reload window: Ctrl+Shift+P → "Developer: Reload Window"

### Issue 2: "Property has no initializer"

**Cause:** `strictPropertyInitialization: true`

**Solutions:**

```typescript
// Option 1: Initialize in constructor
class Example {
  name: string;
  constructor() {
    this.name = 'default';
  }
}

// Option 2: Definite assignment assertion
class Example {
  @Input() name!: string; // I know this will be set
}

// Option 3: Make optional
class Example {
  name?: string;
}
```

### Issue 3: "Type 'undefined' is not assignable"

**Cause:** `noUncheckedIndexedAccess: true`

**Solution:** Handle undefined explicitly

```typescript
const item = array[0]; // Type: T | undefined

// ❌ Won't compile
item.property;

// ✅ Correct
if (item) {
  item.property;
}
// Or
item?.property;
```

### Issue 4: "Not all code paths return a value"

**Cause:** `noImplicitReturns: true`

**Solution:** Ensure all branches return

```typescript
function getStatus(id: number): string {
  if (id > 0) {
    return 'active';
  } else if (id === 0) {
    return 'pending';
  }
  return 'unknown'; // Must cover all paths
}
```

---

## Migration Strategy

If existing code has type errors with strict settings:

### 1. Enable Gradually

Start with less strict, then tighten:

```jsonc
{
  "compilerOptions": {
    "strict": false, // Start here
    "noImplicitAny": true // Enable first
    // ... add more strict options gradually
  }
}
```

### 2. Fix by Priority

1. Fix `noImplicitAny` violations (highest impact)
2. Fix `strictNullChecks` violations
3. Fix `noUnusedLocals/Parameters` (cleanup)
4. Enable remaining strict flags

### 3. Use Type Assertions Temporarily

```typescript
// Temporary fix while refactoring
const data = apiResponse as UserData;

// Better: Add proper types
interface ApiResponse {
  data: UserData;
}
const response: ApiResponse = apiResponse;
```

---

## Build & Development Commands

### Type Checking

```bash
# Check types without building
pnpm nx run frontend:typecheck
pnpm nx run backend:typecheck

# Check all projects
pnpm nx run-many --target=typecheck --all
```

### Development with Type Checking

```bash
# Frontend with type checking
pnpm dev:frontend

# Backend with type checking
pnpm dev:backend

# Both in parallel
pnpm dev
```

### Build with Strict Checks

```bash
# Build frontend (fails on type errors)
pnpm build:frontend

# Build backend (fails on type errors)
pnpm build:backend

# Build all
pnpm build:all
```

---

## IDE Integration

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.suggest.paths": true,
  "typescript.updateImportsOnFileMove.enabled": "always"
}
```

### Recommended Extensions

- **ESLint** - Linting with TypeScript support
- **Angular Language Service** - Template type checking
- **TypeScript Hero** - Auto-import management
- **Error Lens** - Inline error display

---

## Performance Optimization

### Incremental Compilation

Enabled in backend:

```jsonc
{
  "compilerOptions": {
    "incremental": true, // Cache for faster rebuilds
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### Skip Lib Check

Enabled globally:

```jsonc
{
  "compilerOptions": {
    "skipLibCheck": true, // Don't check node_modules types
    "skipDefaultLibCheck": true
  }
}
```

Speeds up compilation without sacrificing app type safety.

---

## Summary

### What We Achieved

✅ **Maximum Type Safety**

- Strict null checks prevent runtime errors
- No implicit any enforces explicit types
- Strict templates catch Angular bugs at compile time

✅ **Better Developer Experience**

- Path mappings for clean imports
- Full autocomplete and IntelliSense
- Catch bugs before runtime

✅ **Platform Optimization**

- Angular-specific compiler options
- NestJS decorator metadata
- Separate test configurations

✅ **Production Ready**

- Declaration files for libraries
- Source maps for debugging
- Optimized output settings

### Next Steps

1. **Restart TypeScript Server**: Ctrl+Shift+P → "TypeScript: Restart TS Server"
2. **Fix Any Type Errors**: Address compilation errors in existing code
3. **Update Imports**: Convert relative imports to path-mapped imports
4. **Test Thoroughly**: Run `pnpm test` to verify tests still pass
5. **Build & Verify**: Run `pnpm build:all` to ensure production builds work

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Angular Compiler Options](https://angular.io/guide/angular-compiler-options)
- [NestJS TypeScript](https://docs.nestjs.com/techniques/typescript)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)
