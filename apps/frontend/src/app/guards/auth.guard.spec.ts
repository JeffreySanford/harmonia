import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { authGuard } from './auth.guard';
import * as AuthSelectors from '../store/auth/auth.selectors';

describe('authGuard', () => {
  let store: MockStore;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [
            { selector: AuthSelectors.selectIsAuthenticated, value: false }
          ]
        }),
        { provide: Router, useValue: routerSpy }
      ]
    });

    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should allow access when user is authenticated', (done) => {
    store.overrideSelector(AuthSelectors.selectIsAuthenticated, true);
    store.refreshState();

    TestBed.runInInjectionContext(() => {
      authGuard(null as any, null as any).subscribe(result => {
        expect(result).toBe(true);
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      });
    });
  });

  it('should deny access and redirect when user is not authenticated', (done) => {
    store.overrideSelector(AuthSelectors.selectIsAuthenticated, false);
    store.refreshState();

    TestBed.runInInjectionContext(() => {
      authGuard(null as any, null as any).subscribe(result => {
        expect(result).toBe(false);
        expect(router.navigate).toHaveBeenCalledWith(['/']);
        done();
      });
    });
  });
});
