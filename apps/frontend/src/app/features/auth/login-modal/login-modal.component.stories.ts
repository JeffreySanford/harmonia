import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { BehaviorSubject, map, Observable, of } from 'rxjs';
import {
  Meta,
  StoryObj,
  applicationConfig,
  moduleMetadata,
} from '@storybook/angular';
import { expect, fn } from 'storybook/test';

import { HealthService } from '../../../services/health.service';
import * as AuthActions from '../../../store/auth/auth.actions';
import {
  AuthState,
  initialAuthState,
} from '../../../store/auth/auth.state';
import { AuthModule } from '../auth.module';
import { LoginModalComponent } from './login-modal.component';

interface LoginStoryState {
  auth: AuthState;
}

class LoginStoryStore {
  private readonly state$: BehaviorSubject<LoginStoryState>;
  readonly dispatchSpy = fn();

  constructor(auth: AuthState) {
    this.state$ = new BehaviorSubject<LoginStoryState>({ auth });
  }

  select<T>(selector: (state: any) => T): Observable<T> {
    return this.state$.pipe(map((state) => selector(state)));
  }

  dispatch(action: unknown): void {
    this.dispatchSpy(action);
  }
}

const dialogRef = {
  close: fn(),
};

const healthService = {
  isBackendReachable: () => of(true),
};

const readyStore = new LoginStoryStore({ ...initialAuthState });
const validationStore = new LoginStoryStore({ ...initialAuthState });
const registerStore = new LoginStoryStore({ ...initialAuthState });
const errorStore = new LoginStoryStore({
  ...initialAuthState,
  error: 'Invalid credentials',
});

const withStore = (store: LoginStoryStore) =>
  moduleMetadata({
    providers: [{ provide: Store, useValue: store }],
  });

const meta: Meta<LoginModalComponent> = {
  title: 'Actual UI/Auth/Login Modal',
  component: LoginModalComponent,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [provideNoopAnimations()],
    }),
    moduleMetadata({
      imports: [AuthModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: HealthService, useValue: healthService },
      ],
    }),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<LoginModalComponent>;

export const SignInReady: Story = {
  decorators: [withStore(readyStore)],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { name: /sign in/i })
    ).toBeVisible();
    await expect(canvas.getByText('Backend OK')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /^sign in$/i })
    ).toBeDisabled();
  },
};

export const ValidLoginDispatchesRealAuthAction: Story = {
  decorators: [withStore(readyStore)],
  play: async ({ canvas, userEvent }) => {
    readyStore.dispatchSpy.mockClear();
    window.localStorage.removeItem('e2e_login_attempt');

    const username = canvas.getByPlaceholderText(
      'user@example.com or username'
    );
    const password = canvas.getByPlaceholderText('Enter your password');
    const signIn = canvas.getByRole('button', { name: /^sign in$/i });

    await userEvent.type(username, 'test-user');
    await userEvent.type(password, 'password');

    await expect(signIn).toBeEnabled();

    await userEvent.click(signIn);

    await expect(readyStore.dispatchSpy).toHaveBeenCalledWith(
      AuthActions.login({
        emailOrUsername: 'test-user',
        password: 'password',
      })
    );

    await expect(
      window.localStorage.getItem('e2e_login_attempt')
    ).toBeTruthy();
  },
};

export const PasswordValidation: Story = {
  decorators: [withStore(validationStore)],
  play: async ({ canvas, userEvent }) => {
    const username = canvas.getByPlaceholderText(
      'user@example.com or username'
    );
    const password = canvas.getByPlaceholderText('Enter your password');
    const signIn = canvas.getByRole('button', { name: /^sign in$/i });

    await userEvent.type(username, 'test-user');
    await userEvent.type(password, 'short');
    await userEvent.tab();

    await expect(signIn).toBeDisabled();
    await expect(
      await canvas.findByText('Password must be at least 8 characters')
    ).toBeVisible();
  },
};

export const BackendAuthError: Story = {
  decorators: [withStore(errorStore)],
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Invalid credentials')).toBeVisible();
    await expect(canvas.getByText('Backend OK')).toBeVisible();
  },
};

export const SwitchToCreateAccount: Story = {
  decorators: [withStore(registerStore)],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /sign up/i })
    );

    await expect(
      canvas.getByRole('heading', { name: /create account/i })
    ).toBeVisible();
    await expect(
      canvas.getByPlaceholderText('user@example.com')
    ).toBeVisible();
    await expect(canvas.getByPlaceholderText('johndoe')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /create account/i })
    ).toBeDisabled();
  },
};
