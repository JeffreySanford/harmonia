import {
  UnauthorizedException,
} from '@nestjs/common';
import {
  ThrottlerGuard,
} from '@nestjs/throttler';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';
import {
  firstValueFrom,
  Observable,
  of,
  throwError,
} from 'rxjs';
import {
  AuthenticatedRefreshRequestUser,
} from './auth-token.config';
import {
  AuthController,
} from './auth.controller';
import {
  AuthResponse,
  AuthService,
  IssuedAuthSession,
  RotatedAuthSession,
} from './auth.service';
import {
  REFRESH_COOKIE_NAME,
  RefreshCookieResponse,
} from './refresh-cookie';
import {
  LoginDto,
} from './dto/login.dto';
import {
  RegisterDto,
} from './dto/register.dto';
import {
  JwtAuthGuard,
} from './guards/jwt-auth.guard';
import {
  RefreshJwtAuthGuard,
} from './guards/refresh-jwt-auth.guard';

type LoginHandler =
  (
    dto:
      LoginDto
  ) =>
    Observable<IssuedAuthSession>;

type RegisterHandler =
  (
    dto:
      RegisterDto
  ) =>
    Observable<IssuedAuthSession>;

type RefreshHandler =
  (
    identity:
      AuthenticatedRefreshRequestUser,
    refreshToken:
      string
  ) =>
    Observable<RotatedAuthSession>;

type LogoutHandler =
  (
    identity:
      AuthenticatedRefreshRequestUser,
    refreshToken:
      string
  ) =>
    Observable<void>;

describe(
  'AuthController refresh-cookie boundary',
  () => {
    const login:
      jest.MockedFunction<LoginHandler> =
      jest.fn();

    const register:
      jest.MockedFunction<RegisterHandler> =
      jest.fn();

    const refresh:
      jest.MockedFunction<RefreshHandler> =
      jest.fn();

    const logout:
      jest.MockedFunction<LogoutHandler> =
      jest.fn();

    const cookie:
      jest.MockedFunction<
        RefreshCookieResponse[
          'cookie'
        ]
      > =
      jest.fn();

    const clearCookie:
      jest.MockedFunction<
        RefreshCookieResponse[
          'clearCookie'
        ]
      > =
      jest.fn();

    const response:
      RefreshCookieResponse = {
        cookie,
        clearCookie,
      };

    const identity:
      AuthenticatedRefreshRequestUser = {
        userId:
          '507f1f77bcf86cd799439011',
        username:
          'testuser',
        email:
          'test@example.com',
        role:
          'user',
        sessionId:
          'session-1',
        familyId:
          'family-1',
      };

    let controller:
      AuthController;

    function publicResponse(
      email:
        string,
      username:
        string
    ): AuthResponse {
      return {
        user: {
          id:
            identity.userId,
          email,
          username,
          role:
            'user',
          createdAt:
            new Date(0)
              .toISOString(),
        },

        accessToken:
          'access-token',

        expiresIn:
          900,
      };
    }

    beforeEach(
      async () => {
        jest.clearAllMocks();

        const module:
          TestingModule =
          await Test
            .createTestingModule({
              controllers: [
                AuthController,
              ],

              providers: [
                {
                  provide:
                    AuthService,

                  useValue: {
                    login,
                    register,
                    refresh,
                    logout,
                  },
                },
              ],
            })

            .overrideGuard(
              ThrottlerGuard
            )
            .useValue({
              canActivate:
                (): boolean =>
                  true,
            })

            .overrideGuard(
              JwtAuthGuard
            )
            .useValue({
              canActivate:
                (): boolean =>
                  true,
            })

            .overrideGuard(
              RefreshJwtAuthGuard
            )
            .useValue({
              canActivate:
                (): boolean =>
                  true,
            })

            .compile();

        controller =
          module.get<AuthController>(
            AuthController
          );
      }
    );

    it(
      'sets refresh credential as HttpOnly cookie while returning only public login data',
      async () => {
        const dto:
          LoginDto = {
            emailOrUsername:
              'a',
            password:
              'pass',
          };

        const publicAuth =
          publicResponse(
            'a@b.com',
            'a'
          );

        login.mockReturnValue(
          of({
            response:
              publicAuth,
            refreshToken:
              'raw-refresh-token',
          })
        );

        const result =
          await firstValueFrom(
            controller.login(
              dto,
              response
            )
          );

        expect(result)
          .toEqual(
            publicAuth
          );

        expect(
          Object.prototype
            .hasOwnProperty
            .call(
              result,
              'refreshToken'
            )
        ).toBe(
          false
        );

        expect(cookie)
          .toHaveBeenCalledWith(
            REFRESH_COOKIE_NAME,
            'raw-refresh-token',
            expect.objectContaining({
              httpOnly:
                true,
              sameSite:
                'strict',
              path:
                '/api/auth',
            })
          );
      }
    );

    it(
      'does not write a refresh cookie when login fails',
      async () => {
        login.mockReturnValue(
          throwError(
            () =>
              new UnauthorizedException(
                'Invalid credentials'
              )
          )
        );

        await expect(
          firstValueFrom(
            controller.login(
              {
                emailOrUsername:
                  'missing',
                password:
                  'bad',
              },
              response
            )
          )
        ).rejects.toThrow(
          UnauthorizedException
        );

        expect(cookie)
          .not
          .toHaveBeenCalled();
      }
    );

    it(
      'sets a refresh cookie after registration without returning the credential',
      async () => {
        const dto:
          RegisterDto = {
            email:
              'new@example.com',
            username:
              'new-user',
            password:
              'StrongPassword123!',
          };

        const publicAuth =
          publicResponse(
            dto.email,
            dto.username
          );

        register.mockReturnValue(
          of({
            response:
              publicAuth,
            refreshToken:
              'registration-refresh-token',
          })
        );

        const result =
          await firstValueFrom(
            controller.register(
              dto,
              response
            )
          );

        expect(result)
          .toEqual(
            publicAuth
          );

        expect(cookie)
          .toHaveBeenCalledWith(
            REFRESH_COOKIE_NAME,
            'registration-refresh-token',
            expect.objectContaining({
              httpOnly:
                true,
            })
          );
      }
    );

    it(
      'rotates the cookie using the presented refresh credential',
      async () => {
        refresh.mockReturnValue(
          of({
            response: {
              accessToken:
                'next-access-token',
              expiresIn:
                900,
            },
            refreshToken:
              'next-refresh-token',
          })
        );

        const result =
          await firstValueFrom(
            controller.refresh(
              {
                user:
                  identity,
              },
              'harmonia_refresh=presented-refresh-token',
              response
            )
          );

        expect(refresh)
          .toHaveBeenCalledWith(
            identity,
            'presented-refresh-token'
          );

        expect(result)
          .toEqual({
            accessToken:
              'next-access-token',
            expiresIn:
              900,
          });

        expect(cookie)
          .toHaveBeenCalledWith(
            REFRESH_COOKIE_NAME,
            'next-refresh-token',
            expect.objectContaining({
              httpOnly:
                true,
            })
          );
      }
    );

    it(
      'revokes the session and clears the cookie on logout',
      async () => {
        logout.mockReturnValue(
          of(undefined)
        );

        const result =
          await firstValueFrom(
            controller.logout(
              {
                user:
                  identity,
              },
              'harmonia_refresh=presented-refresh-token',
              response
            )
          );

        expect(logout)
          .toHaveBeenCalledWith(
            identity,
            'presented-refresh-token'
          );

        expect(clearCookie)
          .toHaveBeenCalledWith(
            REFRESH_COOKIE_NAME,
            expect.objectContaining({
              httpOnly:
                true,
              sameSite:
                'strict',
              path:
                '/api/auth',
            })
          );

        expect(result)
          .toEqual({
            message:
              'Logged out successfully',
            success:
              true,
          });
      }
    );
  }
);
