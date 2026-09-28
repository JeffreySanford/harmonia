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
  AccessTokenPayload,
  AuthenticatedRefreshRequestUser,
} from './auth-token.config';
import {
  AuthService,
} from './auth.service';
import {
  IssuedRefreshSession,
  RefreshSessionPrincipal,
  RefreshSessionService,
} from './refresh-session.service';

interface TestUser {
  _id: {
    toString(): string;
  };
  email: string;
  username: string;
  role: string;
  createdAt: Date;

  comparePassword(
    candidate: string
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

interface ExecutableDelete {
  exec(): Promise<DeleteResult>;
}

type FindOne =
  (
    filter: UserLookupFilter
  ) =>
    Promise<TestUser | null>;

type FindById =
  (
    id: string
  ) =>
    Promise<TestUser | null>;

type DeleteOne =
  (
    filter: DeleteFilter
  ) =>
    ExecutableDelete;

interface SignOptions {
  secret: string;
  expiresIn: number;
}

type SignAccessToken =
  (
    payload: AccessTokenPayload,
    options: SignOptions
  ) =>
    Promise<string>;

type IssueRefreshSession =
  (
    principal:
      RefreshSessionPrincipal
  ) =>
    Promise<IssuedRefreshSession>;

type RotateRefreshSession =
  (
    identity:
      AuthenticatedRefreshRequestUser,
    token:
      string
  ) =>
    Promise<IssuedRefreshSession>;

type RevokeRefreshSession =
  (
    identity:
      AuthenticatedRefreshRequestUser,
    token:
      string
  ) =>
    Promise<void>;

describe(
  'AuthService rotating sessions',
  () => {
    const userId =
      '507f1f77bcf86cd799439011';

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
      jest.MockedFunction<SignAccessToken> =
      jest.fn();

    const issue:
      jest.MockedFunction<IssueRefreshSession> =
      jest.fn();

    const rotate:
      jest.MockedFunction<RotateRefreshSession> =
      jest.fn();

    const revoke:
      jest.MockedFunction<RevokeRefreshSession> =
      jest.fn();

    let service:
      AuthService;

    function createUser(
      passwordValid = true
    ): TestUser {
      return {
        _id: {
          toString:
            () =>
              userId,
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
            candidate:
              string
          ) => {
            void candidate;

            return passwordValid;
          },
      };
    }

    function issuedRefresh(
      refreshToken:
        string
    ): IssuedRefreshSession {
      return {
        refreshToken,
        sessionId:
          'session-2',
        familyId:
          'family-1',
      };
    }

    beforeEach(
      async () => {
        jest.clearAllMocks();

        signAsync
          .mockResolvedValue(
            'access-token'
          );

        issue
          .mockResolvedValue(
            issuedRefresh(
              'refresh-token'
            )
          );

        rotate
          .mockResolvedValue(
            issuedRefresh(
              'rotated-refresh-token'
            )
          );

        revoke
          .mockResolvedValue(
            undefined
          );

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
                    RefreshSessionService,
                  useValue: {
                    issue,
                    rotate,
                    revoke,
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
      'returns the refresh credential only in the internal session envelope',
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
          result.response
            .accessToken
        ).toBe(
          'access-token'
        );

        expect(
          result.refreshToken
        ).toBe(
          'refresh-token'
        );

        expect(
          Object.prototype
            .hasOwnProperty
            .call(
              result.response,
              'refreshToken'
            )
        ).toBe(
          false
        );

        expect(issue)
          .toHaveBeenCalledWith({
            userId,
            username:
              user.username,
            role:
              'user',
          });

        const signCall =
          signAsync.mock.calls[0];

        if (!signCall) {
          throw new Error(
            'Expected access-token signing call.'
          );
        }

        expect(
          signCall[0]
        ).toEqual({
          sub:
            userId,
          username:
            user.username,
          role:
            'user',
          typ:
            'access',
        });

        expect(
          signCall[1].secret
        ).toBe(
          accessSecret
        );

        expect(
          signAsync
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );

    it(
      'delegates refresh credential issuance to the session service',
      async () => {
        const identity:
          AuthenticatedRefreshRequestUser = {
            userId,
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

        const result =
          await firstValueFrom(
            service.refresh(
              identity,
              'presented-refresh-token'
            )
          );

        expect(rotate)
          .toHaveBeenCalledWith(
            identity,
            'presented-refresh-token'
          );

        expect(
          result.response
            .accessToken
        ).toBe(
          'access-token'
        );

        expect(
          result.refreshToken
        ).toBe(
          'rotated-refresh-token'
        );

        expect(
          Object.prototype
            .hasOwnProperty
            .call(
              result.response,
              'refreshToken'
            )
        ).toBe(
          false
        );
      }
    );

    it(
      'revokes the refresh-session family on logout',
      async () => {
        const identity:
          AuthenticatedRefreshRequestUser = {
            userId,
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

        await firstValueFrom(
          service.logout(
            identity,
            'presented-refresh-token'
          )
        );

        expect(revoke)
          .toHaveBeenCalledWith(
            identity,
            'presented-refresh-token'
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

        expect(issue)
          .not
          .toHaveBeenCalled();
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

        expect(issue)
          .not
          .toHaveBeenCalled();
      }
    );

    it(
      'returns a concrete access-session projection',
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
              userId
            )
          );

        expect(result)
          .toEqual({
            id:
              userId,
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
