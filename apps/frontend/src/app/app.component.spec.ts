import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent (Grammarly blocking)', () => {
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    // access fixture.componentInstance locally if needed in tests
  });

  afterEach(() => {
    // cleanup any inputs we added
    document.querySelectorAll('#test-gramm-input').forEach((n) => n.remove());
  });

  it('should set data-gramm attribute on existing inputs when initialized', () => {
    const input = document.createElement('input');
    input.id = 'test-gramm-input';
    document.body.appendChild(input);
    fixture.detectChanges();
    // init should have set the attributes
    expect(input.getAttribute('data-gramm')).toBe('false');
  });

  it('should set data-gramm attribute on dynamically added inputs', (done) => {
    fixture.detectChanges();
    // create after init
    const input = document.createElement('input');
    input.id = 'test-gramm-input';
    // wait a tick so MutationObserver runs
    setTimeout(() => {
      document.body.appendChild(input);
      setTimeout(() => {
        expect(input.getAttribute('data-gramm')).toBe('false');
        input.remove();
        done();
      }, 0);
    }, 0);
  });
});
