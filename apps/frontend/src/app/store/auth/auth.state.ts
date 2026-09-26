/**
 * Auth State
 *
 * Access-token state remains browser-readable.
 * Refresh credentials are owned exclusively by the HttpOnly cookie.
 */

export interface User {
  id: string;
  email: string;
  username: string;
  role:
    | 'admin'
    | 'user'
    | 'guest';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

function readStoredValue(
  key:
    string
): string | null {
  if (
    typeof window ===
    'undefined'
  ) {
    return null;
  }

  try {
    return window.localStorage
      .getItem(
        key
      );
  } catch {
    return null;
  }
}

function removeLegacyRefreshToken():
  void {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  try {
    window.localStorage
      .removeItem(
        'refresh_token'
      );
  } catch {
    // Browser storage may be unavailable.
  }
}

function readStoredUser():
  User | null {
  const raw =
    readStoredValue(
      'auth_user'
    );

  if (!raw) {
    return null;
  }

  try {
    const user =
      JSON.parse(raw) as
        Partial<User>;

    if (
      typeof user.id !==
        'string' ||
      typeof user.email !==
        'string' ||
      typeof user.username !==
        'string' ||
      (
        user.role !==
          'admin' &&
        user.role !==
          'user' &&
        user.role !==
          'guest'
      )
    ) {
      return null;
    }

    return {
      id:
        user.id,
      email:
        user.email,
      username:
        user.username,
      role:
        user.role,
      createdAt:
        typeof user.createdAt ===
        'string'
          ? user.createdAt
          : '',
    };
  } catch {
    return null;
  }
}

removeLegacyRefreshToken();

const persistedUser =
  readStoredUser();

const persistedToken =
  readStoredValue(
    'auth_token'
  );

export const initialAuthState:
  AuthState = {
    user:
      persistedUser,
    token:
      persistedToken,
    isAuthenticated:
      Boolean(
        persistedUser &&
        persistedToken
      ),
    loading:
      false,
    error:
      null,
  };
