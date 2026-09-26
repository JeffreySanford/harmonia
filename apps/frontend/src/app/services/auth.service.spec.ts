import {
  HttpErrorResponse,
} from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  TestBed,
} from '@angular/core/testing';
import {
  AuthResponse,
  AuthService,
  LoginRequest,
  RefreshResponse,
} from './auth.service';

describe(
  'AuthService',
  () => {
    let service:
      AuthService;

    let httpMock:
      HttpTestingController;

    beforeEach(() => {
      window
        .localStorage
        .clear();

      TestBed.configureTestingModule({
        imports: [
          HttpClientTestingModule,
        ],
        providers: [
          AuthService,
        ],
      });

      service =
        TestBed.inject(
          AuthService
        );

      httpMock =
        TestBed.inject(
          HttpTestingController
        );
    });

    afterEach(() => {
      httpMock.verify();

      window
        .localStorage
        .clear();
    });

    it(
      'logs in and returns tokens',
      (done) => {
        const request:
          LoginRequest = {
            emailOrUsername:
              'e2e_user@harmonia.local',
            password:
              'UserP@ssw0rd!',
          };

        const response:
          AuthResponse = {
            user: {
              id:
                '507f1f77bcf86cd799439011',
              email:
                request
                  .emailOrUsername,
              username:
                'e2e_user',
              role:
                'user',
              createdAt:
                '',
            },
            accessToken:
              'access-token',
            refreshToken:
              'refresh-token',
            expiresIn:
              900,
          };

        service
          .login(request)
          .subscribe(
            (result) => {
              expect(
                result.accessToken
              ).toBe(
                'access-token'
              );
              done();
            }
          );

        const req =
          httpMock.expectOne(
            '/api/auth/login'
          );

        expect(
          req.request.method
        ).toBe('POST');

        req.flush(response);
      }
    );

    it(
      'preserves login 401 responses',
      (done) => {
        service
          .login({
            emailOrUsername:
              'invalid@user.com',
            password:
              'wrong',
          })
          .subscribe({
            next: () => {
              fail(
                'Expected login error.'
              );
            },

            error: (
              error:
                HttpErrorResponse
            ) => {
              expect(
                error.status
              ).toBe(401);
              done();
            },
          });

        const req =
          httpMock.expectOne(
            '/api/auth/login'
          );

        req.flush(
          {
            message:
              'Invalid credentials',
          },
          {
            status:
              401,
            statusText:
              'Unauthorized',
          }
        );
      }
    );

    it(
      'sends the refresh token to the refresh endpoint',
      (done) => {
        window.localStorage
          .setItem(
            'refresh_token',
            'refresh-token'
          );

        const response:
          RefreshResponse = {
            accessToken:
              'new-access-token',
            refreshToken:
              'new-refresh-token',
            expiresIn:
              900,
          };

        service
          .refreshToken()
          .subscribe(
            (result) => {
              expect(
                result.accessToken
              ).toBe(
                'new-access-token'
              );
              done();
            }
          );

        const req =
          httpMock.expectOne(
            '/api/auth/refresh'
          );

        expect(
          req.request.headers
            .get(
              'Authorization'
            )
        ).toBe(
          'Bearer refresh-token'
        );

        req.flush(response);
      }
    );

    it(
      'fails locally without a refresh token',
      (done) => {
        service
          .refreshToken()
          .subscribe({
            next: () => {
              fail(
                'Expected refresh error.'
              );
            },

            error: (
              error:
                Error
            ) => {
              expect(
                error.message
              ).toContain(
                'unavailable'
              );
              done();
            },
          });
      }
    );
  }
);
