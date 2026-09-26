import {
  inject,
  Injectable,
} from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
} from '@angular/common/http';
import {
  Observable,
  throwError,
} from 'rxjs';
import {
  User,
} from '../store/auth/auth.state';

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionResponse {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface LogoutResponse {
  message: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl =
    '/api/auth';

  private readonly http =
    inject(HttpClient);

  login(
    credentials:
      LoginRequest
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/login`,
        credentials
      );
  }

  register(
    data:
      RegisterRequest
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/register`,
        data
      );
  }

  logout():
    Observable<LogoutResponse> {
    return this.http
      .post<LogoutResponse>(
        `${this.apiUrl}/logout`,
        {}
      );
  }

  refreshToken():
    Observable<RefreshResponse> {
    const refreshToken =
      this.readRefreshToken();

    if (!refreshToken) {
      return throwError(
        () =>
          new Error(
            'Refresh token is unavailable.'
          )
      );
    }

    return this.http
      .post<RefreshResponse>(
        `${this.apiUrl}/refresh`,
        {},
        {
          headers:
            new HttpHeaders({
              Authorization:
                `Bearer ${refreshToken}`,
            }),
        }
      );
  }

  checkSession():
    Observable<SessionResponse> {
    return this.http
      .get<SessionResponse>(
        `${this.apiUrl}/session`
      );
  }

  private readRefreshToken():
    string | null {
    if (
      typeof window ===
      'undefined'
    ) {
      return null;
    }

    try {
      return window
        .localStorage
        .getItem(
          'refresh_token'
        );
    } catch {
      return null;
    }
  }
}
