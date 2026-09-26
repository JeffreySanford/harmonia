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
  AuthController,
} from './auth.controller';
import {
  AuthResponse,
  AuthService,
} from './auth.service';
import {
  LoginDto,
} from './dto/login.dto';
import {
  RegisterDto,
} from './dto/register.dto';

type LoginHandler =
  (
    dto: LoginDto
  ) => Observable<AuthResponse>;

type RegisterHandler =
  (
    dto: RegisterDto
  ) => Observable<AuthResponse>;

describe(
  'AuthController',
  () => {
    const login:
      jest.MockedFunction<LoginHandler> =
      jest.fn();

    const register:
      jest.MockedFunction<RegisterHandler> =
      jest.fn();

    let controller:
      AuthController;

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
            .compile();

        controller =
          module.get<AuthController>(
            AuthController
          );
      }
    );

    it(
      'delegates login and returns the authentication response',
      async () => {
        const loginDto:
          LoginDto = {
            emailOrUsername:
              'a',
            password:
              'pass',
          };

        const response:
          AuthResponse = {
            user: {
              id:
                '507f1f77bcf86cd799439011',
              email:
                'a@b.com',
              username:
                'a',
              role:
                'user',
              createdAt:
                new Date(0)
                  .toISOString(),
            },

            accessToken:
              'access-token',

            refreshToken:
              'refresh-token',

            expiresIn:
              900,
          };

        login.mockReturnValue(
          of(response)
        );

        const result =
          await firstValueFrom(
            controller.login(
              loginDto
            )
          );

        expect(login)
          .toHaveBeenCalledWith(
            loginDto
          );

        expect(result)
          .toEqual(
            response
          );
      }
    );

    it(
      'propagates an unauthorized login failure',
      async () => {
        const loginDto:
          LoginDto = {
            emailOrUsername:
              'notfound',
            password:
              'pass',
          };

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
              loginDto
            )
          )
        ).rejects.toThrow(
          UnauthorizedException
        );
      }
    );

    it(
      'delegates registration using the typed registration contract',
      async () => {
        const registerDto:
          RegisterDto = {
            email:
              'new@example.com',
            username:
              'new-user',
            password:
              'StrongPassword123!',
          };

        const response:
          AuthResponse = {
            user: {
              id:
                '507f191e810c19729de860ea',
              email:
                registerDto.email,
              username:
                registerDto.username,
              role:
                'user',
              createdAt:
                new Date(0)
                  .toISOString(),
            },

            accessToken:
              'access-token',

            refreshToken:
              'refresh-token',

            expiresIn:
              900,
          };

        register.mockReturnValue(
          of(response)
        );

        const result =
          await firstValueFrom(
            controller.register(
              registerDto
            )
          );

        expect(register)
          .toHaveBeenCalledWith(
            registerDto
          );

        expect(result)
          .toEqual(
            response
          );
      }
    );
  }
);
