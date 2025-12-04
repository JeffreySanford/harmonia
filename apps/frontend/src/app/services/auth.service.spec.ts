import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AuthService, LoginRequest, AuthResponse } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should login with valid credentials and return tokens', (done) => {
    const loginReq: LoginRequest = {
      emailOrUsername: 'e2e_user@harmonia.local',
      password: 'UserP@ssw0rd!',
    };

    const mockResponse: AuthResponse = {
      user: {
        id: '507f1f77bcf86cd799439011',
        email: 'e2e_user@harmonia.local',
        username: 'e2e_user',
        role: 'user',
        createdAt: '',
      },
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      expiresIn: 900,
    };

    service.login(loginReq).subscribe((resp) => {
      expect(resp).toBeTruthy();
      expect(resp.user.email).toBe(loginReq.emailOrUsername);
      expect(resp.accessToken).toBe('fake-access-token');
      done();
    });

    const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should reject invalid credentials (401)', (done) => {
    const loginReq: LoginRequest = {
      emailOrUsername: 'invalid@user.com',
      password: 'wrong',
    };

    service.login(loginReq).subscribe({
      next: () => {
        // should not be called
        fail('Expected error');
      },
      error: (err) => {
        expect(err.status).toBe(401);
        done();
      },
    });

    const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(
      { message: 'Invalid credentials' },
      { status: 401, statusText: 'Unauthorized' }
    );
  });
});
