import { HttpErrorResponse } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  AuthResponse,
  AuthService,
  LoginRequest,
  LogoutResponse,
  RefreshResponse,
} from './auth.service';

let service: AuthService;
let httpMock: HttpTestingController;

function createLoginResponse(request: LoginRequest): AuthResponse {
  return {
    user: {
      id: '507f1f77bcf86cd799439011',
      email: request.emailOrUsername,
      username: 'e2e_user',
      role: 'user',
      createdAt: '',
    },
    accessToken: 'access-token',
    expiresIn: 900,
  };
}

function registerLoginTests(): void {
  it('logs in with credentials enabled and receives no refresh credential in JSON', (done) => {
    const request: LoginRequest = {
      emailOrUsername: 'e2e_user@harmonia.local',
      password: 'UserP@ssw0rd!',
    };

    service.login(request).subscribe((result) => {
      expect(result.accessToken).toBe('access-token');
      expect(
        Object.prototype.hasOwnProperty.call(result, 'refreshToken')
      ).toBe(false);
      done();
    });

    const req = httpMock.expectOne('/api/auth/login');

    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);

    req.flush(createLoginResponse(request));
  });

  it('preserves login 401 responses', (done) => {
    service
      .login({
        emailOrUsername: 'invalid@user.com',
        password: 'wrong',
      })
      .subscribe({
        next: () => fail('Expected login error.'),
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(401);
          done();
        },
      });

    const req = httpMock.expectOne('/api/auth/login');

    req.flush(
      { message: 'Invalid credentials' },
      {
        status: 401,
        statusText: 'Unauthorized',
      }
    );
  });
}

function registerRefreshTests(): void {
  it('refreshes through the HttpOnly cookie without an Authorization header', (done) => {
    const response: RefreshResponse = {
      accessToken: 'new-access-token',
      expiresIn: 900,
    };

    service.refreshToken().subscribe((result) => {
      expect(result.accessToken).toBe('new-access-token');
      done();
    });

    const req = httpMock.expectOne('/api/auth/refresh');

    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush(response);
  });

  it('logs out through the HttpOnly refresh cookie', (done) => {
    const response: LogoutResponse = {
      message: 'Logged out successfully',
      success: true,
    };

    service.logout().subscribe((result) => {
      expect(result.success).toBe(true);
      done();
    });

    const req = httpMock.expectOne('/api/auth/logout');

    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush(response);
  });
}

describe('AuthService HttpOnly refresh boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    window.localStorage.clear();
  });

  registerLoginTests();
  registerRefreshTests();
});
