# UX Enhancements

## Overview

This document outlines the implementation of user experience enhancements including keyboard shortcuts, theme management, and notification systems to improve usability and accessibility.

## Keyboard Shortcuts

### Feature Description

**Purpose**: Provide keyboard shortcuts for common actions to improve workflow efficiency and accessibility.

**Scope**: Global shortcuts and context-specific shortcuts for music generation, annotation, and navigation.

### Implementation

#### Global Shortcuts

| Shortcut | Action                    | Context |
| -------- | ------------------------- | ------- |
| `Ctrl+N` | New song generation       | Global  |
| `Ctrl+O` | Open existing song        | Global  |
| `Ctrl+S` | Save current song         | Global  |
| `Ctrl+Z` | Undo last action          | Global  |
| `Ctrl+Y` | Redo last action          | Global  |
| `Ctrl+P` | Open command palette      | Global  |
| `F1`     | Show help                 | Global  |
| `Esc`    | Close modal/cancel action | Global  |

#### Music Generation Shortcuts

| Shortcut | Action                     | Context         |
| -------- | -------------------------- | --------------- |
| `Space`  | Play/pause generation      | Generation view |
| `Ctrl+G` | Generate new section       | Generation view |
| `Ctrl+R` | Regenerate current section | Generation view |
| `Ctrl+M` | Toggle metronome           | Generation view |
| `Ctrl+T` | Toggle tempo control       | Generation view |

#### Annotation Shortcuts

| Shortcut    | Action                     | Context         |
| ----------- | -------------------------- | --------------- |
| `Ctrl+A`    | Add annotation             | Annotation view |
| `Ctrl+D`    | Delete selected annotation | Annotation view |
| `Ctrl+E`    | Edit annotation            | Annotation view |
| `Tab`       | Next annotation            | Annotation view |
| `Shift+Tab` | Previous annotation        | Annotation view |

#### Navigation Shortcuts

| Shortcut    | Action               | Context |
| ----------- | -------------------- | ------- |
| `Ctrl+1`    | Switch to Dashboard  | Global  |
| `Ctrl+2`    | Switch to Library    | Global  |
| `Ctrl+3`    | Switch to Generation | Global  |
| `Ctrl+4`    | Switch to Settings   | Global  |
| `Alt+Left`  | Previous page        | Global  |
| `Alt+Right` | Next page            | Global  |

### Technical Implementation

#### Keyboard Service

```typescript
// src/app/services/keyboard.service.ts
@Injectable({
  providedIn: 'root',
})
export class KeyboardService {
  private shortcuts = new Map<string, ShortcutConfig>();

  constructor(private router: Router, private store: Store) {
    this.initializeShortcuts();
    this.setupGlobalListeners();
  }

  private initializeShortcuts(): void {
    // Global shortcuts
    this.addShortcut('ctrl+n', () => this.handleNewSong());
    this.addShortcut('ctrl+o', () => this.handleOpenSong());
    this.addShortcut('ctrl+s', () => this.handleSaveSong());
    this.addShortcut('ctrl+z', () => this.handleUndo());
    this.addShortcut('ctrl+y', () => this.handleRedo());
    this.addShortcut('ctrl+p', () => this.handleCommandPalette());
    this.addShortcut('f1', () => this.handleHelp());
    this.addShortcut('escape', () => this.handleEscape());

    // Context-specific shortcuts
    this.addShortcut('space', () => this.handlePlayPause(), 'generation');
    this.addShortcut('ctrl+g', () => this.handleGenerate(), 'generation');
    this.addShortcut('ctrl+r', () => this.handleRegenerate(), 'generation');
  }

  private setupGlobalListeners(): void {
    document.addEventListener('keydown', (event) => {
      const key = this.getKeyCombination(event);
      const shortcut = this.shortcuts.get(key);

      if (shortcut && this.isContextValid(shortcut.context)) {
        event.preventDefault();
        shortcut.action();
      }
    });
  }

  private getKeyCombination(event: KeyboardEvent): string {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  private isContextValid(context?: string): boolean {
    if (!context) return true;
    return this.currentContext === context;
  }

  // Action handlers
  private handleNewSong(): void {
    this.router.navigate(['/generation/new']);
  }

  private handleSaveSong(): void {
    this.store.dispatch(saveCurrentSong());
  }

  private handleUndo(): void {
    this.store.dispatch(undoAction());
  }

  private handleRedo(): void {
    this.store.dispatch(redoAction());
  }

  private handlePlayPause(): void {
    this.store.dispatch(togglePlayback());
  }

  private handleGenerate(): void {
    this.store.dispatch(generateNewSection());
  }

  private handleRegenerate(): void {
    this.store.dispatch(regenerateCurrentSection());
  }

  private handleCommandPalette(): void {
    // Open command palette component
    this.store.dispatch(openCommandPalette());
  }

  private handleHelp(): void {
    this.router.navigate(['/help']);
  }

  private handleEscape(): void {
    this.store.dispatch(closeModal());
  }
}

interface ShortcutConfig {
  key: string;
  action: () => void;
  context?: string;
  description: string;
}
```

#### Shortcut Registration

```typescript
// src/app/components/shortcut-registry.directive.ts
@Directive({
  selector: '[appShortcut]',
})
export class ShortcutRegistryDirective implements OnInit, OnDestroy {
  @Input() appShortcut: string;
  @Input() shortcutContext?: string;

  constructor(private keyboardService: KeyboardService) {}

  ngOnInit(): void {
    this.keyboardService.registerShortcut({
      key: this.appShortcut,
      action: () => this.handleShortcut(),
      context: this.shortcutContext,
    });
  }

  ngOnDestroy(): void {
    this.keyboardService.unregisterShortcut(this.appShortcut);
  }

  private handleShortcut(): void {
    // Emit event or call component method
    this.shortcutTriggered.emit();
  }

  @Output() shortcutTriggered = new EventEmitter<void>();
}
```

### Testing

#### Unit Tests

```typescript
describe('KeyboardService', () => {
  let service: KeyboardService;
  let router: Router;
  let store: Store;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        KeyboardService,
        {
          provide: Router,
          useValue: jasmine.createSpyObj('Router', ['navigate']),
        },
        {
          provide: Store,
          useValue: jasmine.createSpyObj('Store', ['dispatch']),
        },
      ],
    });

    service = TestBed.inject(KeyboardService);
    router = TestBed.inject(Router);
    store = TestBed.inject(Store);
  });

  it('should handle global shortcuts', () => {
    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true });
    document.dispatchEvent(event);

    expect(router.navigate).toHaveBeenCalledWith(['/generation/new']);
  });

  it('should handle context-specific shortcuts', () => {
    service.setCurrentContext('generation');
    const event = new KeyboardEvent('keydown', { key: ' ', ctrlKey: false });
    document.dispatchEvent(event);

    expect(store.dispatch).toHaveBeenCalledWith(togglePlayback());
  });
});
```

## Theme Management

### Feature Description

**Purpose**: Allow users to customize the application's appearance with different themes and color schemes.

**Themes Supported**:

- Light theme
- Dark theme
- High contrast theme
- Custom themes (future enhancement)

### Implementation

#### Theme Service

```typescript
// src/app/services/theme.service.ts
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private currentTheme = signal<Theme>('light');
  private availableThemes = ['light', 'dark', 'high-contrast'];

  constructor() {
    this.loadSavedTheme();
    this.applyTheme(this.currentTheme());
  }

  getCurrentTheme(): Signal<Theme> {
    return this.currentTheme.asReadonly();
  }

  setTheme(theme: Theme): void {
    if (!this.availableThemes.includes(theme)) {
      throw new Error(`Invalid theme: ${theme}`);
    }

    this.currentTheme.set(theme);
    this.applyTheme(theme);
    this.saveTheme(theme);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', this.getThemeColor(theme));
    }
  }

  private getThemeColor(theme: Theme): string {
    const colors = {
      light: '#ffffff',
      dark: '#1a1a1a',
      'high-contrast': '#000000',
    };
    return colors[theme] || '#ffffff';
  }

  private loadSavedTheme(): void {
    const saved = localStorage.getItem('harmonia-theme');
    if (saved && this.availableThemes.includes(saved)) {
      this.currentTheme.set(saved as Theme);
    }
  }

  private saveTheme(theme: Theme): void {
    localStorage.setItem('harmonia-theme', theme);
  }

  getAvailableThemes(): string[] {
    return [...this.availableThemes];
  }
}

type Theme = 'light' | 'dark' | 'high-contrast';
```

#### Theme Variables (SCSS)

```scss
// src/styles/themes/_variables.scss
:root {
  // Light theme
  --primary-color: #1976d2;
  --secondary-color: #dc004e;
  --background-color: #ffffff;
  --surface-color: #f5f5f5;
  --text-primary: #212121;
  --text-secondary: #757575;
  --border-color: #e0e0e0;
  --shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

[data-theme='dark'] {
  --primary-color: #90caf9;
  --secondary-color: #f48fb1;
  --background-color: #121212;
  --surface-color: #1e1e1e;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --border-color: #333333;
  --shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

[data-theme='high-contrast'] {
  --primary-color: #ffff00;
  --secondary-color: #ff6b6b;
  --background-color: #000000;
  --surface-color: #000000;
  --text-primary: #ffffff;
  --text-secondary: #ffff00;
  --border-color: #ffffff;
  --shadow: 0 2px 4px rgba(255, 255, 255, 0.5);
}
```

#### Theme Selector Component

```typescript
// src/app/components/theme-selector/theme-selector.component.ts
@Component({
  selector: 'app-theme-selector',
  template: `
    <mat-form-field appearance="outline">
      <mat-label>Theme</mat-label>
      <mat-select
        [value]="currentTheme()"
        (valueChange)="onThemeChange($event)"
      >
        <mat-option *ngFor="let theme of availableThemes" [value]="theme">
          {{ theme | titlecase }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `,
  styles: [
    `
      mat-form-field {
        width: 200px;
      }
    `,
  ],
})
export class ThemeSelectorComponent {
  currentTheme = this.themeService.getCurrentTheme();
  availableThemes = this.themeService.getAvailableThemes();

  constructor(private themeService: ThemeService) {}

  onThemeChange(theme: string): void {
    this.themeService.setTheme(theme as Theme);
  }
}
```

### Testing

```typescript
describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
    localStorage.clear();
  });

  it('should apply light theme by default', () => {
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should change theme', () => {
    service.setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should save theme to localStorage', () => {
    service.setTheme('dark');
    expect(localStorage.getItem('harmonia-theme')).toBe('dark');
  });

  it('should load saved theme', () => {
    localStorage.setItem('harmonia-theme', 'high-contrast');
    const newService = new ThemeService();
    expect(newService.getCurrentTheme()()).toBe('high-contrast');
  });
});
```

## Notification System

### Feature Description

**Purpose**: Provide user feedback for actions, errors, and system events through a comprehensive notification system.

**Types of Notifications**:

- Success notifications
- Error notifications
- Warning notifications
- Info notifications
- Toast notifications
- Persistent notifications

### Implementation

#### Notification Service

```typescript
// src/app/services/notification.service.ts
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notifications = signal<Notification[]>([]);

  constructor(private snackBar: MatSnackBar) {}

  showSuccess(message: string, action?: string): void {
    this.showNotification({
      type: 'success',
      message,
      action,
      duration: 3000,
    });
  }

  showError(message: string, action?: string): void {
    this.showNotification({
      type: 'error',
      message,
      action,
      duration: 5000,
    });
  }

  showWarning(message: string, action?: string): void {
    this.showNotification({
      type: 'warning',
      message,
      action,
      duration: 4000,
    });
  }

  showInfo(message: string, action?: string): void {
    this.showNotification({
      type: 'info',
      message,
      action,
      duration: 3000,
    });
  }

  showPersistent(message: string, type: NotificationType = 'info'): void {
    const notification: Notification = {
      id: this.generateId(),
      type,
      message,
      persistent: true,
      timestamp: new Date(),
    };

    this.notifications.update((notifications) => [
      ...notifications,
      notification,
    ]);
  }

  dismissNotification(id: string): void {
    this.notifications.update((notifications) =>
      notifications.filter((n) => n.id !== id)
    );
  }

  private showNotification(config: NotificationConfig): void {
    const snackBarRef = this.snackBar.open(config.message, config.action, {
      duration: config.duration,
      panelClass: `snackbar-${config.type}`,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });

    if (config.action) {
      snackBarRef.onAction().subscribe(() => {
        // Handle action
      });
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getNotifications(): Signal<Notification[]> {
    return this.notifications.asReadonly();
  }
}

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  action?: string;
  persistent?: boolean;
  timestamp: Date;
}

interface NotificationConfig {
  type: NotificationType;
  message: string;
  action?: string;
  duration: number;
}

type NotificationType = 'success' | 'error' | 'warning' | 'info';
```

#### Notification Component

```typescript
// src/app/components/notification-list/notification-list.component.ts
@Component({
  selector: 'app-notification-list',
  template: `
    <div class="notification-list">
      <mat-card
        *ngFor="let notification of notifications()"
        class="notification-card"
        [ngClass]="'notification-' + notification.type"
      >
        <mat-card-content>
          <div class="notification-content">
            <mat-icon class="notification-icon">{{
              getIcon(notification.type)
            }}</mat-icon>
            <span class="notification-message">{{ notification.message }}</span>
            <button
              mat-icon-button
              class="notification-close"
              (click)="dismiss(notification.id)"
              *ngIf="notification.persistent"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .notification-list {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 1000;
        max-width: 400px;
      }

      .notification-card {
        margin-bottom: 10px;
        border-radius: 8px;
      }

      .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .notification-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .notification-message {
        flex: 1;
      }

      .notification-close {
        margin-left: auto;
      }

      .notification-success {
        border-left: 4px solid #4caf50;
      }
      .notification-error {
        border-left: 4px solid #f44336;
      }
      .notification-warning {
        border-left: 4px solid #ff9800;
      }
      .notification-info {
        border-left: 4px solid #2196f3;
      }
    `,
  ],
})
export class NotificationListComponent {
  notifications = this.notificationService.getNotifications();

  constructor(private notificationService: NotificationService) {}

  getIcon(type: NotificationType): string {
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };
    return icons[type];
  }

  dismiss(id: string): void {
    this.notificationService.dismissNotification(id);
  }
}
```

### Testing

```typescript
describe('NotificationService', () => {
  let service: NotificationService;
  let snackBar: MatSnackBar;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        {
          provide: MatSnackBar,
          useValue: jasmine.createSpyObj('MatSnackBar', ['open']),
        },
      ],
    });

    service = TestBed.inject(NotificationService);
    snackBar = TestBed.inject(MatSnackBar);
  });

  it('should show success notification', () => {
    service.showSuccess('Operation completed successfully');

    expect(snackBar.open).toHaveBeenCalledWith(
      'Operation completed successfully',
      undefined,
      jasmine.objectContaining({
        duration: 3000,
        panelClass: 'snackbar-success',
      })
    );
  });

  it('should show persistent notification', () => {
    service.showPersistent('Important message', 'warning');

    const notifications = service.getNotifications()();
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe('warning');
    expect(notifications[0].persistent).toBe(true);
  });

  it('should dismiss notification', () => {
    service.showPersistent('Test message');
    const notifications = service.getNotifications()();
    const id = notifications[0].id;

    service.dismissNotification(id);

    expect(service.getNotifications()().length).toBe(0);
  });
});
```

## Accessibility Considerations

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Tab order should follow logical reading order
- Focus indicators must be visible
- Skip links for main navigation sections

### Screen Reader Support

- ARIA labels for dynamic content
- Live regions for status updates
- Semantic HTML structure
- Descriptive alt text for icons

### High Contrast Support

- Minimum contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Focus indicators visible in high contrast mode
- Color-independent design patterns

## Performance Considerations

### Keyboard Shortcuts

- Debounce rapid key presses
- Use passive event listeners where possible
- Minimize DOM queries in keyboard handlers

### Theme Management

- CSS custom properties for efficient theme switching
- Avoid full stylesheet reloads
- Cache theme preferences locally

### Notifications

- Limit concurrent notifications (max 3-5)
- Auto-dismiss non-critical notifications
- Use CSS transforms for smooth animations

## Related Documentation

- `COMPONENT_ARCHITECTURE.md` - Component design patterns
- `TYPESCRIPT_CONFIGURATION.md` - TypeScript setup and patterns
- `TESTING_CHECKLIST.md` - Testing guidelines
- `SECURITY.md` - Security considerations
