import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { App } from './app';
import { RouterTestingModule } from '@angular/router/testing';
import { appRoutes } from './app.routes';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes(appRoutes)],
      declarations: [App],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        provideMockStore({
          initialState: {
            auth: { user: null, isAuthenticated: true },
            library: {
              items: [],
              filters: {},
              pagination: {
                currentPage: 1,
                totalPages: 0,
                total: 0,
                pageSize: 20,
              },
              loading: false,
              error: null,
              selectedItem: null,
            },
            profile: {
              profile: null,
              loading: false,
              error: null,
            },
          },
        }),
      ],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Harmonia');
  });

  it('should redirect to landing when user becomes a guest and is on protected route', fakeAsync(() => {
    const store = TestBed.inject(MockStore);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    // Set router to a protected route
    router.navigateByUrl('/library');
    tick();
    // Create component and initialize
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    tick();
    // Simulate auth change: from true -> false
    store.setState({
      auth: {
        user: null,
        isAuthenticated: false,
        token: null,
        refreshToken: null,
        loading: false,
        error: null,
      },
      library: {
        items: [],
        filters: {},
        pagination: { currentPage: 1, totalPages: 0, total: 0, pageSize: 20 },
        loading: false,
        error: null,
        selectedItem: null,
      },
      profile: {
        profile: null,
        loading: false,
        error: null,
      },
    });
    // Allow change detection and event queue to process
    fixture.detectChanges();
    tick();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  }));

  it('should hide sidebar when user is a guest', () => {
    const store = TestBed.inject(MockStore);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    // Initially authenticated so sidebar present
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-sidebar')).not.toBeNull();
    // Switch to guest
    store.setState({ auth: { user: null, isAuthenticated: false } });
    fixture.detectChanges();
    expect(compiled.querySelector('.app-sidebar')).toBeNull();
  });
});
