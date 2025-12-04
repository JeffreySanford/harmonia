import { TestBed } from '@angular/core/testing';
import {
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { type Observable } from 'rxjs';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { adminGuard } from './admin.guard';
import * as AuthSelectors from '../store/auth/auth.selectors';

describe('adminGuard', () => {
  let store: MockStore;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [{ selector: AuthSelectors.selectIsAdmin, value: false }],
        }),
        { provide: Router, useValue: routerSpy },
      ],
    });

    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should allow access when user is admin', (done) => {
    store.overrideSelector(AuthSelectors.selectIsAdmin, true);
    store.refreshState();

    TestBed.runInInjectionContext(() => {
      const result = adminGuard(
        null as unknown as ActivatedRouteSnapshot,
        null as unknown as RouterStateSnapshot
      );

      if (typeof result === 'boolean') {
        expect(result).toBe(true);
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      } else {
        // Handle observable/promise case
        (result as unknown as Observable<boolean>).subscribe((res: boolean) => {
          expect(res).toBe(true);
          expect(router.navigate).not.toHaveBeenCalled();
          done();
        });
      }
    });
  });

  it('should deny access and redirect when user is not admin', (done) => {
    store.overrideSelector(AuthSelectors.selectIsAdmin, false);
    store.refreshState();

    TestBed.runInInjectionContext(() => {
      const result = adminGuard(
        null as unknown as ActivatedRouteSnapshot,
        null as unknown as RouterStateSnapshot
      );

      if (typeof result === 'boolean') {
        expect(result).toBe(false);
        expect(router.navigate).toHaveBeenCalledWith(['/']);
        done();
      } else {
        // Handle observable/promise case
        (result as unknown as Observable<boolean>).subscribe((res: boolean) => {
          expect(res).toBe(false);
          expect(router.navigate).toHaveBeenCalledWith(['/']);
          done();
        });
      }
    });
  });
});
