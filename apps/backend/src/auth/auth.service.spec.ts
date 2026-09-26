import {
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import {
  JwtService,
} from '@nestjs/jwt';
import {
  getModelToken,
} from '@nestjs/mongoose';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';
import {
  firstValueFrom,
} from 'rxjs';
import {
  User,
} from '../schemas/user.schema';
import {
  AuthTokenPayload,
} from './auth-token.config';
import {
  AuthService,
} from './auth.service';

interface TestUser {
  _id: {
    toString(): string;
  };
  email: string;
  username: string;
  role: string;
  createdAt: Date;
  comparePassword(
    candidate:
      string
  ): Promise<boolean>;
}

interface UserLookupFilter {
  $or: Array<
    | {
        email: string;
      }
    | {
        username: string;
      }
  >;
}

interface DeleteFilter {
  email: string;
}

interface DeleteResult {
  deletedCount: number;
}

type FindOne =
  (
    filter:
      UserLookupFilter
  ) =>
    Promise<TestUser | null>;

type FindById =
  (
    id: string
  ) =>
    Promise<TestUser | null>;

type DeleteOne =
  (
    filter:
      DeleteFilter
  ) =>
    Promise<DeleteResult>;

interface SignOptions {
  secret: string;
  expiresIn: number;
}

type SignToken =
  (
    payload:
      AuthTokenPayload,
    options:
      SignOptions
  ) =>
    Promise<string>;

describe(
  'AuthService token boundary',
  () => {
    const accessSecret =
      'access-secret-for-tests-012345678901234567890';

    const refreshSecret =
      'refresh-secret-for-tests-01234567890123456789';

    const findOne:
      jest.MockedFunction<FindOne> =
      jest.fn();

    const findById:
      jest.MockedFunction<FindById> =
      jest.fn();

    const deleteOne:
      jest.MockedFunction<DeleteOne> =
      jest.fn();

    const signAsync:
      jest.MockedFunction<SignToken> =
      jest.fn(
        async (
          payload,
          _options
        ) =>
          payload.typ ===
          'access'
            ? 'access-token'
            : 'refresh-token'
      );

    let service:
      AuthService;

    function createUser(
      passwordValid =
        true
    ): TestUser {
      return {
        _id: {
          toString:
            () =>
              '507f1f77bcf86cd799439011',
        },
        email:
          'test@example.com',
        username:
          'testuser',
        role:
          'user',
        createdAt:
          new Date(0),
        comparePassword:
          async (
            _candidate
          ) =>
            passwordValid,
      };
    }

    beforeEach(
      async () => {
        jest.clearAllMocks();

        const configService = {
          get(
            key: string
          ): string | undefined {
            if (
              key ===
              'JWT_SECRET'
            ) {
              return accessSecret;
            }

            if (
              key ===
              'JWT_REFRESH_SECRET'
            ) {
              return refreshSecret;
            }

            return undefined;
          },
        };

        const module:
          TestingModule =
          await Test
            .createTestingModule({
              providers: [
                AuthService,

                {
                  provide:
                    JwtService,
                  useValue: {
                    signAsync,
                  },
                },

                {
                  provide:
                    ConfigService,
                  useValue:
                    configService,
                },

                {
                  provide:
                    getModelToken(
                      User.name
                    ),
                  useValue: {
                    findOne,
                    findById,
                    deleteOne,
                  },
                },
              ],
            })
            .compile();

        service =
          module.get<AuthService>(
            AuthService
          );
      }
    );

    it(
      'uses separate token types and secrets',
      async () => {
        const user =
          createUser();

        findOne
          .mockResolvedValueOnce(
            user
          );

        const result =
          await firstValueFrom(
            service.login({
              emailOrUsername:
                user.email,
              password:
                'password',
            })
          );

        expect(
          result.accessToken
        ).toBe(
          'access-token'
        );

        expect(
          result.refreshToken
        ).toBe(
          'refresh-token'
        );

        const accessCall =
          signAsync.mock.calls[0];

        const refreshCall =
          signAsync.mock.calls[1];

        if (
          !accessCall ||
          !refreshCall
        ) {
          throw new Error(
            'Expected two token signing calls.'
          );
        }

        expect(
          accessCall[0].typ
        ).toBe(
          'access'
        );

        expect(
          accessCall[1].secret
        ).toBe(
          accessSecret
        );

        expect(
          refreshCall[0].typ
        ).toBe(
          'refresh'
        );

        expect(
          refreshCall[1].secret
        ).toBe(
          refreshSecret
        );

        expect(
          accessCall[1].secret
        ).not.toBe(
          refreshCall[1].secret
        );
      }
    );

    it(
      'rejects a missing user',
      async () => {
        findOne
          .mockResolvedValueOnce(
            null
          );

        await expect(
          firstValueFrom(
            service.login({
              emailOrUsername:
                'missing@example.com',
              password:
                'password',
            })
          )
        ).rejects.toThrow(
          UnauthorizedException
        );
      }
    );

    it(
      'rejects an invalid password',
      async () => {
        findOne
          .mockResolvedValueOnce(
            createUser(false)
          );

        await expect(
          firstValueFrom(
            service.login({
              emailOrUsername:
                'test@example.com',
              password:
                'wrong',
            })
          )
        ).rejects.toThrow(
          UnauthorizedException
        );
      }
    );

    it(
      'returns a concrete session projection',
      async () => {
        const user =
          createUser();

        findById
          .mockResolvedValueOnce(
            user
          );

        const result =
          await firstValueFrom(
            service.validateSession(
              user._id.toString()
            )
          );

        expect(result).toEqual({
          id:
            user._id.toString(),
          email:
            user.email,
          username:
            user.username,
          role:
            'user',
        });
      }
    );
  }
);
