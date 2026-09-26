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
  createHash,
} from 'node:crypto';
import {
  Types,
} from 'mongoose';
import {
  RefreshSession,
} from '../schemas/refresh-session.schema';
import {
  AuthenticatedRefreshRequestUser,
  RefreshTokenPayload,
} from './auth-token.config';
import {
  RefreshSessionRecord,
  RefreshSessionService,
} from './refresh-session.service';

interface ExecResult<T> {
  exec(): Promise<T>;
}

interface SignOptions {
  secret: string;
  expiresIn: number;
}

type SignRefreshToken =
  (
    payload:
      RefreshTokenPayload,
    options:
      SignOptions
  ) =>
    Promise<string>;

describe(
  'RefreshSessionService',
  () => {
    const userId =
      '507f1f77bcf86cd799439011';

    const accessSecret =
      'access-secret-for-tests-012345678901234567890';

    const refreshSecret =
      'refresh-secret-for-tests-01234567890123456789';

    const create =
      jest.fn();

    const findOneAndUpdate =
      jest.fn();

    const findOne =
      jest.fn();

    const updateMany =
      jest.fn();

    const signAsync:
      jest.MockedFunction<SignRefreshToken> =
      jest.fn();

    let service:
      RefreshSessionService;

    const exec =
      <T>(
        value:
          T
      ): ExecResult<T> => ({
        exec:
          async () =>
            value,
      });

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
          'old-session',
        familyId:
          'family-1',
      };

    const activeRecord:
      RefreshSessionRecord = {
        userId:
          new Types.ObjectId(
            userId
          ),
        sessionId:
          'old-session',
        familyId:
          'family-1',
        tokenHash:
          'old-hash',
        expiresAt:
          new Date(
            Date.now() +
              60_000
          ),
      };

    beforeEach(
      async () => {
        jest.clearAllMocks();

        const config = {
          get(
            key:
              string
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
                RefreshSessionService,
                {
                  provide:
                    getModelToken(
                      RefreshSession.name
                    ),
                  useValue: {
                    create,
                    findOneAndUpdate,
                    findOne,
                    updateMany,
                  },
                },
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
                    config,
                },
              ],
            })
            .compile();

        service =
          module.get(
            RefreshSessionService
          );
      }
    );

    it(
      'stores only a hash of the issued refresh credential',
      async () => {
        signAsync
          .mockResolvedValueOnce(
            'raw-refresh-token'
          );

        create
          .mockImplementationOnce(
            async (
              record:
                RefreshSessionRecord
            ) =>
              record
          );

        const issued =
          await service.issue({
            userId,
            username:
              'testuser',
            role:
              'user',
          });

        expect(
          issued.refreshToken
        ).toBe(
          'raw-refresh-token'
        );

        const createCall =
          create.mock.calls[0];

        if (!createCall) {
          throw new Error(
            'Expected persisted refresh session.'
          );
        }

        const record =
          createCall[0];

        expect(
          record.tokenHash
        ).toBe(
          createHash(
            'sha256'
          )
            .update(
              'raw-refresh-token'
            )
            .digest(
              'hex'
            )
        );

        expect(
          record.tokenHash
        ).not.toBe(
          issued.refreshToken
        );

        const signCall =
          signAsync.mock.calls[0];

        if (!signCall) {
          throw new Error(
            'Expected refresh signing call.'
          );
        }

        expect(
          signCall[0].typ
        ).toBe(
          'refresh'
        );

        expect(
          signCall[0].sid
        ).toBe(
          issued.sessionId
        );

        expect(
          signCall[0].fid
        ).toBe(
          issued.familyId
        );

        expect(
          signCall[1].secret
        ).toBe(
          refreshSecret
        );
      }
    );

    it(
      'atomically consumes the old session before persisting its replacement',
      async () => {
        signAsync
          .mockResolvedValueOnce(
            'rotated-token'
          );

        findOneAndUpdate
          .mockReturnValueOnce(
            exec(
              activeRecord
            )
          );

        create
          .mockImplementationOnce(
            async (
              record:
                RefreshSessionRecord
            ) =>
              record
          );

        const rotated =
          await service.rotate(
            identity,
            'old-raw-token'
          );

        const rotationCall =
          findOneAndUpdate
            .mock.calls[0];

        if (!rotationCall) {
          throw new Error(
            'Expected atomic rotation update.'
          );
        }

        expect(
          rotationCall[0]
            .tokenHash
        ).toBe(
          createHash(
            'sha256'
          )
            .update(
              'old-raw-token'
            )
            .digest(
              'hex'
            )
        );

        expect(
          rotationCall[0]
            .revokedAt
        ).toBeNull();

        expect(
          rotationCall[1]
            .$set
            .revokeReason
        ).toBe(
          'rotated'
        );

        expect(
          rotated.familyId
        ).toBe(
          identity.familyId
        );

        expect(
          rotated.sessionId
        ).not.toBe(
          identity.sessionId
        );
      }
    );

    it(
      'revokes the active family when an already rotated credential is reused',
      async () => {
        signAsync
          .mockResolvedValueOnce(
            'unused-next-token'
          );

        findOneAndUpdate
          .mockReturnValueOnce(
            exec(null)
          );

        findOne
          .mockReturnValueOnce(
            exec({
              ...activeRecord,
              revokedAt:
                new Date(),
              revokeReason:
                'rotated',
            })
          );

        updateMany
          .mockReturnValueOnce(
            exec({
              modifiedCount:
                1,
            })
          );

        await expect(
          service.rotate(
            identity,
            'reused-token'
          )
        ).rejects.toThrow(
          UnauthorizedException
        );

        const revokeCall =
          updateMany
            .mock.calls[0];

        if (!revokeCall) {
          throw new Error(
            'Expected family revocation.'
          );
        }

        expect(
          revokeCall[0]
        ).toEqual({
          familyId:
            identity.familyId,
          revokedAt:
            null,
        });

        expect(
          revokeCall[1]
            .$set
            .revokeReason
        ).toBe(
          'reuse-detected'
        );
      }
    );
  }
);
