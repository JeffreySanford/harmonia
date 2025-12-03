# Unit Testing Guide

**Last Updated**: December 2, 2025  
**Project**: Harmonia Music Generation Platform  
**Testing Framework**: Jest + Angular Testing Library

---

## Overview

This document provides comprehensive guidelines for writing and maintaining unit tests in the Harmonia project. We use Jest as our testing framework with Angular-specific testing utilities.

---

## Table of Contents

- [Test Status](#test-status)
- [Running Tests](#running-tests)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [Known Issues](#known-issues)
- [Best Practices](#best-practices)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)

---

## Test Status

### Backend Tests ✅

**Status**: All passing (2/2 test suites)

```bash
PASS  apps/backend/src/app/app.service.spec.ts
PASS  apps/backend/src/app/app.controller.spec.ts

Test Suites: 2 passed, 2 total
Tests:       2 passed, 2 total
```

**Coverage**: Basic controller and service tests implemented

### Frontend Tests ⚠️

**Status**: 7 test suites need Angular 21 compatibility updates

**Issues**:

- Tests cannot find `@angular/core/testing` module
- Jasmine type definitions missing (SpyObj)
- Guard tests using old Observable-based API (now returns boolean directly)
- Component tests using deprecated testing patterns

**Affected Files**:

1. `apps/frontend/src/app/app.spec.ts`
2. `apps/frontend/src/app/guards/auth.guard.spec.ts`
3. `apps/frontend/src/app/guards/admin.guard.spec.ts`
4. `apps/frontend/src/app/interceptors/auth.interceptor.spec.ts`
5. `apps/frontend/src/app/features/auth/login-modal/login-modal.component.spec.ts`
6. `apps/frontend/src/app/features/auth/header-user-menu/header-user-menu.component.spec.ts`
7. `apps/frontend/src/app/services/auth-ui.service.spec.ts`

---

## Running Tests

### Run All Tests

```bash
# Run all tests in workspace
pnpm nx run-many --target=test --all

# Run with code coverage
pnpm nx run-many --target=test --all --code-coverage
```

### Run Backend Tests

```bash
# Run backend tests
pnpm nx test backend

# With coverage
pnpm nx test backend --code-coverage

# Watch mode
pnpm nx test backend --watch
```

### Run Frontend Tests

```bash
# Run frontend tests
pnpm nx test frontend

# With coverage
pnpm nx test frontend --code-coverage

# Watch mode
pnpm nx test frontend --watch

# Run specific test file
pnpm nx test frontend --testFile=auth.guard.spec.ts
```

### Clear Cache

```bash
# Clear Jest cache
pnpm nx reset

# Skip Nx cache
pnpm nx test frontend --skip-nx-cache
```

---

## Backend Testing

### Test Structure

Backend tests use Jest with NestJS testing utilities.

**Example Test** (`app.service.spec.ts`):

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return greeting message', () => {
    expect(service.getData()).toEqual({ message: 'Hello API' });
  });
});
```

### Testing Controllers

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = app.get<AppController>(AppController);
    service = app.get<AppService>(AppService);
  });

  it('should return data from service', () => {
    const result = { message: 'Hello API' };
    jest.spyOn(service, 'getData').mockImplementation(() => result);
    
    expect(controller.getData()).toBe(result);
  });
});
```

### Testing Services with Dependencies

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let userModel: Model<User>;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'mock-token'),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should create user', async () => {
    const dto = { email: 'test@example.com', username: 'test', password: 'password123' };
    jest.spyOn(userModel, 'create').mockResolvedValue({ ...dto, _id: '123' } as any);

    const result = await service.register(dto);
    expect(result).toHaveProperty('_id');
  });
});
```

---

## Frontend Testing

### Current Status

Frontend tests need Angular 21 migration. Tests were written for Angular 20 testing patterns.

### Migration Required

**Old Pattern (Angular 20)**:

```typescript
// Guards returned Observable<boolean>
authGuard(null as any, null as any).subscribe(result => {
  expect(result).toBe(true);
});
```

**New Pattern (Angular 21)**:

```typescript
// Guards now return boolean or UrlTree directly
const result = authGuard(null as any, null as any);
expect(result).toBe(true);
```

### Component Testing Template

Once migration is complete, use this pattern:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideStore } from '@ngrx/store';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent, NoopAnimationsModule],
      providers: [
        provideStore({}),
        // Add other providers
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

### Guard Testing Template

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';

describe('authGuard', () => {
  let store: Store;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Store,
          useValue: {
            select: jest.fn(() => of(false)),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: jest.fn(() => ({} as any)),
          },
        },
      ],
    });

    store = TestBed.inject(Store);
    router = TestBed.inject(Router);
  });

  it('should allow authenticated users', (done) => {
    jest.spyOn(store, 'select').mockReturnValue(of(true));
    
    const result = authGuard(null as any, null as any);
    expect(result).toBe(true);
    done();
  });
});
```

### Service Testing Template

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should login user', () => {
    const mockResponse = {
      user: { id: '1', email: 'test@example.com' },
      accessToken: 'token',
      refreshToken: 'refresh',
    };

    service.login({ emailOrUsername: 'test', password: 'pass' }).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
```

---

## Known Issues

### Frontend Test Failures

**Issue**: Tests cannot find Angular testing modules

**Error**:

```bash
error TS2307: Cannot find module '@angular/core/testing' or its corresponding type declarations.
```

**Cause**: Tests written for Angular 20 testing API, need migration to Angular 21 patterns

**Status**: Non-blocking for development. Tests will be migrated as part of testing quality improvements.

**Workaround**: Backend tests pass successfully. Frontend functionality verified via manual testing.

### Jasmine Type Errors

**Issue**: `jasmine.SpyObj` type not found

**Cause**: Type definition mismatch with Angular 21

**Resolution**: Will be addressed in testing migration sprint

---

## Best Practices

### 1. Test Naming

```typescript
// Good
it('should return user data when login is successful', () => {});

// Bad
it('test 1', () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should calculate total price', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];
  
  // Act
  const total = calculateTotal(items);
  
  // Assert
  expect(total).toBe(30);
});
```

### 3. Mock External Dependencies

```typescript
// Good - mocked
const mockService = {
  getData: jest.fn(() => of({ data: 'test' })),
};

// Bad - real service
const service = new RealService(); // May cause side effects
```

### 4. One Assertion Per Test (When Possible)

```typescript
// Good
it('should return correct status code', () => {
  expect(response.status).toBe(200);
});

it('should return user data', () => {
  expect(response.body).toHaveProperty('user');
});

// Acceptable when testing related properties
it('should return valid user object', () => {
  expect(response.body.user).toBeDefined();
  expect(response.body.user.id).toBe('123');
  expect(response.body.user.email).toBe('test@example.com');
});
```

### 5. Avoid Test Interdependence

```typescript
// Bad - tests depend on order
let sharedState: any;

it('test 1', () => {
  sharedState = { value: 1 };
});

it('test 2', () => {
  expect(sharedState.value).toBe(1); // Fails if test 1 doesn't run first
});

// Good - each test is independent
it('test 1', () => {
  const state = { value: 1 };
  expect(state.value).toBe(1);
});

it('test 2', () => {
  const state = { value: 1 };
  expect(state.value).toBe(1);
});
```

---

## Writing New Tests

### Backend Service Test Example

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyNewService } from './my-new.service';

describe('MyNewService', () => {
  let service: MyNewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyNewService],
    }).compile();

    service = module.get<MyNewService>(MyNewService);
  });

  describe('myMethod', () => {
    it('should return expected result', () => {
      const result = service.myMethod('input');
      expect(result).toBe('expected output');
    });

    it('should handle null input', () => {
      const result = service.myMethod(null);
      expect(result).toBeNull();
    });

    it('should throw error for invalid input', () => {
      expect(() => service.myMethod('invalid')).toThrow();
    });
  });
});
```

### Frontend Component Test Example

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyNewComponent } from './my-new.component';

describe('MyNewComponent', () => {
  let component: MyNewComponent;
  let fixture: ComponentFixture<MyNewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyNewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MyNewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display title', () => {
    component.title = 'Test Title';
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Test Title');
  });

  it('should call method on button click', () => {
    jest.spyOn(component, 'handleClick');
    
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    
    expect(component.handleClick).toHaveBeenCalled();
  });
});
```

---

## Troubleshooting

### Tests Won't Run

**Problem**: `Cannot find module` errors

**Solution**:

```bash
# Clear cache and reinstall
pnpm nx reset
rm -rf node_modules
pnpm install
```

### Tests Pass Locally But Fail in CI

**Problem**: Environment differences

**Solution**:

- Check Node.js version matches CI
- Ensure all dependencies in package.json
- Clear cache: `pnpm nx reset`

### Slow Tests

**Problem**: Tests take too long to run

**Solution**:

- Use `--skip-nx-cache` to skip remote cache
- Run specific test file instead of all tests
- Check for unnecessary async operations

### Mock Not Working

**Problem**: Real service is being called instead of mock

**Solution**:

```typescript
// Ensure mock is provided correctly
{
  provide: MyService,
  useValue: {
    method: jest.fn(() => 'mocked result'),
  },
}

// Verify spy is called
expect(mockService.method).toHaveBeenCalledWith(expectedArg);
```

---

## Coverage Goals

### Current Coverage

- **Backend**: ~30% (basic tests only)
- **Frontend**: 0% (tests need migration)

### Target Coverage

- **Backend**: 80% line coverage
- **Frontend**: 80% line coverage
- **Critical Paths**: 100% coverage (authentication, payments, data loss prevention)

### Generate Coverage Report

```bash
# Backend
pnpm nx test backend --code-coverage

# Frontend (once tests are fixed)
pnpm nx test frontend --code-coverage

# View report
open coverage/apps/backend/index.html
open coverage/apps/frontend/index.html
```

---

## Next Steps

1. **Immediate**: Backend unit tests are passing ✅
2. **Short-term**: Migrate frontend tests to Angular 21 patterns
3. **Mid-term**: Increase coverage to 80% for both frontend and backend
4. **Long-term**: Add integration tests and E2E tests

---

## Related Documentation

- [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) - E2E testing scenarios
- [FRONTEND_BACKEND_INTEGRATION.md](./FRONTEND_BACKEND_INTEGRATION.md) - Integration details
- [AUTHENTICATION_SYSTEM.md](./AUTHENTICATION_SYSTEM.md) - Auth architecture
- [NGRX_PATTERNS.md](./NGRX_PATTERNS.md) - State management patterns

---

**Maintained By**: Development Team  
**Last Review**: December 2, 2025
