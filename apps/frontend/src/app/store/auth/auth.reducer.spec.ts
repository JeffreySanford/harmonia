import { authReducer } from './auth.reducer';
import type { AuthState } from './auth.state';
import * as AuthActions from './auth.actions';

describe('authReducer guest reset', () => {
  const authenticatedState: AuthState = {
    user: {
      id: 'user-1',
      email: 'admin@harmonia.local',
      username: 'admin',
      role: 'admin',
      createdAt: new Date(0).toISOString(),
    },
    token: 'expired.jwt.token',
    refreshToken: 'refresh.jwt.token',
    isAuthenticated: true,
    loading: false,
    error: null,
  };

  const expectedGuest: AuthState = {
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  };

  it('clears hydrated auth state on logout success', () => {
    expect(
      authReducer(
        authenticatedState,
        AuthActions.logoutSuccess()
      )
    ).toEqual(expectedGuest);
  });

  it('clears hydrated auth state on invalid session', () => {
    expect(
      authReducer(
        authenticatedState,
        AuthActions.sessionInvalid()
      )
    ).toEqual(expectedGuest);
  });
});
