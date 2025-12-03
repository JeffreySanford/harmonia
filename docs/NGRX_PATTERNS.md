# NGRX State Management Patterns

## Overview

Harmonia uses **NGRX 20.1.0** for predictable state management following Redux patterns. This guide covers architecture, best practices, and implementation patterns for Phase 1.

## Store Architecture

### Root State (`apps/frontend/src/app/store/app.state.ts`)

```typescript
export interface AppState {
  auth: AuthState;       // User authentication and session
  models: ModelsState;   // Model artifact management
  datasets: DatasetsState; // Audio dataset explorer
  jobs: JobsState;       // Job queue and real-time updates
}
```

### Feature Store Pattern

Each feature follows a strict file structure:

```text
store/
├── app.state.ts                # Root state interface
└── <feature>/
    ├── <feature>.state.ts      # State interface and initial state
    ├── <feature>.actions.ts    # Action creators
    ├── <feature>.reducer.ts    # Reducer function
    ├── <feature>.selectors.ts  # Memoized selectors
    └── <feature>.effects.ts    # Side effects (API calls)
```

## State Interface Pattern

### Basic State

```typescript
export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};
```

### Entity State (Normalized Data)

```typescript
import { EntityState } from '@ngrx/entity';

export interface ModelArtifact {
  id: string;
  name: string;
  version: string;
  // ... other properties
}

export interface ModelsState extends EntityState<ModelArtifact> {
  selectedModelId: string | null;
  loading: boolean;
  error: string | null;
  filters: {
    search: string;
    modelType: string | null;
    tags: string[];
  };
}
```

## Actions Pattern

### Action Naming Convention

```text
[Feature] Action Name
```

Examples:

- `[Auth] Login`
- `[Models] Load Models Success`
- `[Jobs] Job Progress Updated`

### Action Structure

```typescript
import { createAction, props } from '@ngrx/store';

// Simple action (no payload)
export const logout = createAction('[Auth] Logout');

// Action with payload
export const login = createAction(
  '[Auth] Login',
  props<{ email: string; password: string }>()
);

// Success/Failure pattern
export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ user: User; token: string; refreshToken: string }>()
);

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>()
);
```

### Async Operation Pattern (Request/Success/Failure)

```typescript
// Load operation
export const loadModels = createAction('[Models] Load Models');

export const loadModelsSuccess = createAction(
  '[Models] Load Models Success',
  props<{ models: ModelArtifact[] }>()
);

export const loadModelsFailure = createAction(
  '[Models] Load Models Failure',
  props<{ error: string }>()
);
```

### Real-Time Update Actions

```typescript
// WebSocket events dispatch these actions
export const jobStatusUpdated = createAction(
  '[Jobs] Job Status Updated',
  props<{ id: string; status: JobStatus }>()
);

export const jobProgressUpdated = createAction(
  '[Jobs] Job Progress Updated',
  props<{ id: string; progress: JobProgress }>()
);
```

## Reducer Pattern

### Basic Reducer

```typescript
import { createReducer, on } from '@ngrx/store';
import * as AuthActions from './auth.actions';

export const authReducer = createReducer(
  initialAuthState,

  // Loading state
  on(AuthActions.login, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  // Success state (update multiple properties)
  on(AuthActions.loginSuccess, (state, { user, token, refreshToken }) => ({
    ...state,
    user,
    token,
    refreshToken,
    isAuthenticated: true,
    loading: false,
  })),

  // Error state
  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Reset state
  on(AuthActions.logoutSuccess, () => initialAuthState)
);
```

### Entity Adapter Reducer

```typescript
import { createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';

export const modelsAdapter: EntityAdapter<ModelArtifact> =
  createEntityAdapter<ModelArtifact>({
    selectId: (model) => model.id,
    sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
  });

export const initialModelsState: ModelsState = modelsAdapter.getInitialState({
  selectedModelId: null,
  loading: false,
  error: null,
  filters: { search: '', modelType: null, tags: [] },
});

export const modelsReducer = createReducer(
  initialModelsState,

  // Set all entities
  on(ModelsActions.loadModelsSuccess, (state, { models }) =>
    modelsAdapter.setAll(models, { ...state, loading: false })
  ),

  // Add one entity
  on(ModelsActions.createModelSuccess, (state, { model }) =>
    modelsAdapter.addOne(model, { ...state, loading: false })
  ),

  // Update one entity
  on(ModelsActions.updateModelSuccess, (state, { model }) =>
    modelsAdapter.updateOne(
      { id: model.id, changes: model },
      { ...state, loading: false }
    )
  ),

  // Remove one entity
  on(ModelsActions.deleteModelSuccess, (state, { id }) =>
    modelsAdapter.removeOne(id, { ...state, loading: false })
  )
);

// Export entity adapter selectors
export const { selectAll, selectEntities, selectIds, selectTotal } =
  modelsAdapter.getSelectors();
```

## Selectors Pattern

### Feature Selector

```typescript
import { createFeatureSelector } from '@ngrx/store';

export const selectAuthState = createFeatureSelector<AuthState>('auth');
```

### Memoized Selectors

```typescript
import { createSelector } from '@ngrx/store';

// Direct property access
export const selectUser = createSelector(
  selectAuthState,
  (state) => state.user
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state) => state.isAuthenticated
);

// Derived/computed selectors
export const selectUserRole = createSelector(
  selectUser,
  (user) => user?.role || 'guest'
);

export const selectIsAdmin = createSelector(
  selectUserRole,
  (role) => role === 'admin'
);

// Combining multiple selectors
export const selectAuthStatus = createSelector(
  selectIsAuthenticated,
  selectAuthLoading,
  (isAuthenticated, loading) => ({
    isAuthenticated,
    loading,
  })
);
```

### Entity Adapter Selectors

```typescript
import * as fromModels from './models.reducer';

// Use adapter selectors
export const selectAllModels = createSelector(
  selectModelsState,
  fromModels.selectAll
);

export const selectModelsEntities = createSelector(
  selectModelsState,
  fromModels.selectEntities
);

// Select specific entity by ID
export const selectSelectedModel = createSelector(
  selectModelsEntities,
  selectSelectedModelId,
  (entities, selectedId) => (selectedId ? entities[selectedId] : null)
);
```

### Filtered/Derived Selectors

```typescript
// Client-side filtering
export const selectFilteredModels = createSelector(
  selectAllModels,
  selectModelsFilters,
  (models, filters) => {
    return models.filter((model) => {
      const matchesSearch =
        !filters.search ||
        model.name.toLowerCase().includes(filters.search.toLowerCase());

      const matchesType = !filters.modelType || model.type === filters.modelType;

      const matchesTags =
        filters.tags.length === 0 ||
        filters.tags.some((tag) => model.tags.includes(tag));

      return matchesSearch && matchesType && matchesTags;
    });
  }
);

// Parameterized selector factory
export const selectModelById = (id: string) =>
  createSelector(selectModelsEntities, (entities) => entities[id]);
```

## Effects Pattern

### Basic Effect (API Call)

```typescript
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { ModelsService } from '../../services/models.service';
import * as ModelsActions from './models.actions';

@Injectable()
export class ModelsEffects {
  loadModels$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModelsActions.loadModels),
      mergeMap(() =>
        this.modelsService.getModels().pipe(
          map((models) => ModelsActions.loadModelsSuccess({ models })),
          catchError((error) =>
            of(
              ModelsActions.loadModelsFailure({
                error: error.message || 'Failed to load models',
              })
            )
          )
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private modelsService: ModelsService
  ) {}
}
```

### Effect with Router Navigation

```typescript
import { Router } from '@angular/router';

@Injectable()
export class AuthEffects {
  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(() => {
          this.router.navigate(['/dashboard']);
        })
      ),
    { dispatch: false } // Non-dispatching effect
  );

  constructor(
    private actions$: Actions,
    private router: Router
  ) {}
}
```

### Effect with Action Payload Mapping

```typescript
createJob$ = createEffect(() =>
  this.actions$.pipe(
    ofType(JobsActions.createJob),
    mergeMap((action) =>
      this.jobsService
        .createJob({
          jobType: action.jobType,
          parameters: action.parameters,
          priority: action.priority,
        })
        .pipe(
          map((job) => JobsActions.createJobSuccess({ job })),
          catchError((error) =>
            of(
              JobsActions.createJobFailure({
                error: error.message || 'Failed to create job',
              })
            )
          )
        )
    )
  )
);
```

## Store Configuration

### Module Registration (`app-module.ts`)

```typescript
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { isDevMode } from '@angular/core';

// Import reducers
import { authReducer } from './store/auth/auth.reducer';
import { modelsReducer } from './store/models/models.reducer';

// Import effects
import { AuthEffects } from './store/auth/auth.effects';
import { ModelsEffects } from './store/models/models.effects';

@NgModule({
  imports: [
    StoreModule.forRoot(
      {
        auth: authReducer,
        models: modelsReducer,
        datasets: datasetsReducer,
        jobs: jobsReducer,
      },
      {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
          strictActionWithinNgZone: true,
          strictActionTypeUniqueness: true,
        },
      }
    ),
    EffectsModule.forRoot([
      AuthEffects,
      ModelsEffects,
      DatasetsEffects,
      JobsEffects,
    ]),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
    }),
  ],
})
export class AppModule {}
```

## Component Integration

### Dispatching Actions

```typescript
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './store/app.state';
import * as AuthActions from './store/auth/auth.actions';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  constructor(private store: Store<AppState>) {}

  onLogin(email: string, password: string): void {
    this.store.dispatch(AuthActions.login({ email, password }));
  }
}
```

### Selecting State

```typescript
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from './store/app.state';
import * as fromAuth from './store/auth/auth.selectors';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
  user$!: Observable<User | null>;
  isAuthenticated$!: Observable<boolean>;

  constructor(private store: Store<AppState>) {}

  ngOnInit(): void {
    this.user$ = this.store.select(fromAuth.selectUser);
    this.isAuthenticated$ = this.store.select(fromAuth.selectIsAuthenticated);
  }
}
```

### Using Async Pipe

```html
<div *ngIf="isAuthenticated$ | async">
  <p>Welcome, {{ (user$ | async)?.username }}!</p>
  <button (click)="onLogout()">Logout</button>
</div>

<div *ngIf="!(isAuthenticated$ | async)">
  <a routerLink="/login">Login</a>
</div>
```

## Best Practices

### 1. Single-Purpose Actions

❌ **Bad**: Generic action

```typescript
export const updateState = createAction('[App] Update State', props<{ data: any }>());
```

✅ **Good**: Specific actions

```typescript
export const login = createAction('[Auth] Login', props<{ email: string; password: string }>());
export const loginSuccess = createAction('[Auth] Login Success', props<{ user: User; token: string }>());
```

### 2. Immutable State Updates

❌ **Bad**: Mutating state

```typescript
on(AuthActions.loginSuccess, (state, { user }) => {
  state.user = user; // Mutation!
  return state;
});
```

✅ **Good**: Spread operator

```typescript
on(AuthActions.loginSuccess, (state, { user }) => ({
  ...state,
  user,
  isAuthenticated: true,
}));
```

### 3. Error Handling in Effects

✅ **Always** use catchError:

```typescript
loadModels$ = createEffect(() =>
  this.actions$.pipe(
    ofType(ModelsActions.loadModels),
    mergeMap(() =>
      this.modelsService.getModels().pipe(
        map((models) => ModelsActions.loadModelsSuccess({ models })),
        catchError((error) =>
          of(ModelsActions.loadModelsFailure({ error: error.message }))
        )
      )
    )
  )
);
```

### 4. Selector Memoization

✅ **Always** use `createSelector` for derived state:

```typescript
// Memoized - only recalculates when dependencies change
export const selectFilteredModels = createSelector(
  selectAllModels,
  selectFilters,
  (models, filters) => models.filter(/* ... */)
);
```

### 5. Avoid `any` Types

❌ **Bad**:

```typescript
export const updateData = createAction('[App] Update', props<{ data: any }>());
```

✅ **Good**:

```typescript
export const updateModel = createAction(
  '[Models] Update',
  props<{ id: string; changes: Partial<ModelArtifact> }>()
);
```

### 6. Use Entity Adapters for Collections

✅ For arrays of entities with IDs, **always** use `@ngrx/entity`:

```typescript
import { createEntityAdapter } from '@ngrx/entity';

export const modelsAdapter = createEntityAdapter<ModelArtifact>({
  selectId: (model) => model.id,
});
```

### 7. Reserved Property Names

⚠️ **Never** use `type` as a property name in action props (reserved by NGRX):

```typescript
// ❌ Bad - `type` is reserved
export const setFilter = createAction('[Models] Set Filter', props<{ type: string }>());

// ✅ Good - Use alternative name
export const setFilter = createAction('[Models] Set Filter', props<{ modelType: string }>());
```

## Debugging

### Redux DevTools

Install [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension.

Features:

- **Action Inspector**: See all dispatched actions
- **State Diff**: View state changes
- **Time Travel**: Jump to any previous state
- **Action Replay**: Replay actions

### Console Logging

Add meta-reducer for logging:

```typescript
import { ActionReducer, MetaReducer } from '@ngrx/store';

export function logger(reducer: ActionReducer<any>): ActionReducer<any> {
  return (state, action) => {
    console.log('state', state);
    console.log('action', action);
    return reducer(state, action);
  };
}

export const metaReducers: MetaReducer<any>[] = [logger];
```

Register in `StoreModule.forRoot`:

```typescript
StoreModule.forRoot(reducers, { metaReducers });
```

## Testing

### Testing Reducers

```typescript
import { authReducer, initialAuthState } from './auth.reducer';
import * as AuthActions from './auth.actions';

describe('AuthReducer', () => {
  it('should set loading on login', () => {
    const action = AuthActions.login({ email: 'test@test.com', password: '123' });
    const state = authReducer(initialAuthState, action);

    expect(state.loading).toBe(true);
    expect(state.error).toBe(null);
  });

  it('should update user on login success', () => {
    const user = { id: '1', email: 'test@test.com', username: 'test', role: 'user', createdAt: '2025-01-01' };
    const action = AuthActions.loginSuccess({ user, token: 'token', refreshToken: 'refresh' });
    const state = authReducer(initialAuthState, action);

    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
    expect(state.loading).toBe(false);
  });
});
```

### Testing Selectors

```typescript
import * as fromAuth from './auth.selectors';

describe('AuthSelectors', () => {
  const mockState = {
    auth: {
      user: { id: '1', username: 'test', role: 'admin' },
      isAuthenticated: true,
      loading: false,
      error: null,
    },
  };

  it('should select user', () => {
    const result = fromAuth.selectUser.projector(mockState.auth);
    expect(result).toEqual(mockState.auth.user);
  });

  it('should select isAdmin', () => {
    const result = fromAuth.selectIsAdmin.projector('admin');
    expect(result).toBe(true);
  });
});
```

### Testing Effects

```typescript
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, throwError } from 'rxjs';
import { ModelsEffects } from './models.effects';
import { ModelsService } from '../../services/models.service';
import * as ModelsActions from './models.actions';

describe('ModelsEffects', () => {
  let actions$: Observable<any>;
  let effects: ModelsEffects;
  let modelsService: jasmine.SpyObj<ModelsService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('ModelsService', ['getModels']);

    TestBed.configureTestingModule({
      providers: [
        ModelsEffects,
        provideMockActions(() => actions$),
        { provide: ModelsService, useValue: spy },
      ],
    });

    effects = TestBed.inject(ModelsEffects);
    modelsService = TestBed.inject(ModelsService) as jasmine.SpyObj<ModelsService>;
  });

  it('should return loadModelsSuccess on success', (done) => {
    const models = [{ id: '1', name: 'Model 1' }];
    modelsService.getModels.and.returnValue(of(models));
    actions$ = of(ModelsActions.loadModels());

    effects.loadModels$.subscribe((action) => {
      expect(action).toEqual(ModelsActions.loadModelsSuccess({ models }));
      done();
    });
  });
});
```

## Resources

- [NGRX Documentation](https://ngrx.io)
- [NGRX Entity Adapter](https://ngrx.io/guide/entity)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools)
- [RxJS Operators](https://rxjs.dev/guide/operators)
