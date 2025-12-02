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

export const initialAuthState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};
