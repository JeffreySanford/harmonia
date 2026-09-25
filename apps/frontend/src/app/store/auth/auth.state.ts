/**
 * Auth State
 * Manages authentication, user session, and permissions
 */

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredUser(): User | null {
  const raw = readStoredValue('auth_user');

  if (!raw) {
    return null;
  }

  try {
    const user = JSON.parse(raw) as User;

    if (
      !user ||
      typeof user.id !== 'string' ||
      typeof user.email !== 'string' ||
      typeof user.username !== 'string' ||
      !['admin', 'user', 'guest'].includes(user.role)
    ) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

const persistedUser = readStoredUser();
const persistedToken = readStoredValue('auth_token');
const persistedRefreshToken =
  readStoredValue('refresh_token');

export const initialAuthState: AuthState = {
  user: persistedUser,
  token: persistedToken,
  refreshToken: persistedRefreshToken,
  isAuthenticated: Boolean(
    persistedUser && persistedToken
  ),
  loading: false,
  error: null,
};
