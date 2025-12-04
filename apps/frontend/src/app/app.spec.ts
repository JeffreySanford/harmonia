import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { App } from './app';
import { RouterModule } from '@angular/router';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [App],
      providers: [
        provideMockStore({
          initialState: { auth: { user: null, isAuthenticated: true } },
        }),
        {
          provide: Router,
          useValue: jasmine.createSpyObj('Router', ['navigate'], {
            url: '/library',
          }),
        },
      ],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Harmonia');
  });

  it('should redirect to landing when user becomes a guest and is on protected route', () => {
    const store = TestBed.inject(MockStore);
    const router = TestBed.inject(Router) as unknown as jasmine.SpyObj<Router>;
    // Create component and initialize
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    // Simulate auth change: from true -> false
    store.setState({ auth: { user: null, isAuthenticated: false } });
    // Allow change detection and event queue to process
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

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
