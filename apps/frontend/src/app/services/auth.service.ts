import {
  inject,
  Injectable,
} from '@angular/core';
import {
  HttpClient,
} from '@angular/common/http';
import {
  Observable,
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
  expiresIn: number;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface SessionResponse {
  id: string;
  email: string;
  username: string;
  role:
    | 'admin'
    | 'user'
    | 'guest';
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
        credentials,
        {
          withCredentials:
            true,
        }
      );
  }

  register(
    data:
      RegisterRequest
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.apiUrl}/register`,
        data,
        {
          withCredentials:
            true,
        }
      );
  }

  logout():
    Observable<LogoutResponse> {
    return this.http
      .post<LogoutResponse>(
        `${this.apiUrl}/logout`,
        {},
        {
          withCredentials:
            true,
        }
      );
  }

  refreshToken():
    Observable<RefreshResponse> {
    return this.http
      .post<RefreshResponse>(
        `${this.apiUrl}/refresh`,
        {},
        {
          withCredentials:
            true,
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
}
