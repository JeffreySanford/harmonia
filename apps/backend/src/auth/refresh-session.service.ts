import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import {
  JwtService,
} from '@nestjs/jwt';
import {
  InjectModel,
} from '@nestjs/mongoose';
import {
  createHash,
  randomUUID,
} from 'node:crypto';
import {
  Types,
} from 'mongoose';
import {
  AuthenticatedRefreshRequestUser,
  AuthUserRole,
  REFRESH_TOKEN_SECONDS,
  RefreshTokenPayload,
  requireIndependentAuthSecrets,
} from './auth-token.config';
import {
  RefreshSession,
  RefreshSessionRevokeReason,
} from '../schemas/refresh-session.schema';

interface Executable<T> {
  exec(): Promise<T>;
}

export interface RefreshSessionRecord {
  userId: Types.ObjectId;
  sessionId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBySessionId?: string;
  revokeReason?:
    RefreshSessionRevokeReason;
}

export interface RefreshSessionPrincipal {
  userId: string;
  username: string;
  role: AuthUserRole;
}

interface RefreshSessionCreate {
  userId: Types.ObjectId;
  sessionId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

interface RotationFilter {
  userId: Types.ObjectId;
  sessionId: string;
  familyId: string;
  tokenHash: string;
  revokedAt: null;
  expiresAt: {
    $gt: Date;
  };
}

interface SessionIdentityFilter {
  userId: Types.ObjectId;
  sessionId: string;
  familyId: string;
  tokenHash?: string;
}

interface SessionFamilyFilter {
  familyId: string;
  revokedAt: null;
}

interface SessionRevocation {
  revokedAt: Date;
  revokeReason:
    RefreshSessionRevokeReason;
  replacedBySessionId?: string;
}

interface SessionUpdate {
  $set:
    SessionRevocation;
}

interface UpdateResult {
  modifiedCount: number;
}

export interface RefreshSessionStore {
  create(
    input:
      RefreshSessionCreate
  ): Promise<RefreshSessionRecord>;

  findOneAndUpdate(
    filter:
      RotationFilter,
    update:
      SessionUpdate,
    options: {
      new: true;
    }
  ): Executable<
    RefreshSessionRecord | null
  >;

  findOne(
    filter:
      SessionIdentityFilter
  ): Executable<
    RefreshSessionRecord | null
  >;

  updateMany(
    filter:
      SessionFamilyFilter,
    update:
      SessionUpdate
  ): Executable<UpdateResult>;
}

export interface IssuedRefreshSession {
  refreshToken: string;
  sessionId: string;
  familyId: string;
}

interface PreparedRefreshSession
  extends IssuedRefreshSession {
  record:
    RefreshSessionCreate;
}

@Injectable()
export class RefreshSessionService {
  private readonly refreshSecret:
    string;

  constructor(
    @InjectModel(
      RefreshSession.name
    )
    private readonly sessions:
      RefreshSessionStore,

    private readonly jwtService:
      JwtService,

    configService:
      ConfigService
  ) {
    this.refreshSecret =
      requireIndependentAuthSecrets(
        configService
      ).refresh;
  }

  async issue(
    principal:
      RefreshSessionPrincipal
  ): Promise<IssuedRefreshSession> {
    const prepared =
      await this.prepare(
        principal,
        randomUUID()
      );

    await this.sessions.create(
      prepared.record
    );

    return {
      refreshToken:
        prepared.refreshToken,
      sessionId:
        prepared.sessionId,
      familyId:
        prepared.familyId,
    };
  }

  async rotate(
    identity:
      AuthenticatedRefreshRequestUser,
    presentedToken:
      string
  ): Promise<IssuedRefreshSession> {
    const principal:
      RefreshSessionPrincipal = {
        userId:
          identity.userId,
        username:
          identity.username,
        role:
          identity.role,
      };

    const prepared =
      await this.prepare(
        principal,
        identity.familyId
      );

    const now =
      new Date();

    const current =
      await this.sessions
        .findOneAndUpdate(
          {
            userId:
              new Types.ObjectId(
                identity.userId
              ),
            sessionId:
              identity.sessionId,
            familyId:
              identity.familyId,
            tokenHash:
              this.hashToken(
                presentedToken
              ),
            revokedAt:
              null,
            expiresAt: {
              $gt:
                now,
            },
          },
          {
            $set: {
              revokedAt:
                now,
              revokeReason:
                'rotated',
              replacedBySessionId:
                prepared.sessionId,
            },
          },
          {
            new:
              true,
          }
        )
        .exec();

    if (!current) {
      const previous =
        await this.sessions
          .findOne({
            userId:
              new Types.ObjectId(
                identity.userId
              ),
            sessionId:
              identity.sessionId,
            familyId:
              identity.familyId,
          })
          .exec();

      if (
        previous?.revokedAt
      ) {
        await this.revokeFamily(
          identity.familyId,
          'reuse-detected'
        );
      }

      throw new UnauthorizedException(
        'Refresh session is no longer valid'
      );
    }

    try {
      await this.sessions.create(
        prepared.record
      );
    } catch {
      await this.revokeFamily(
        identity.familyId,
        'rotation-write-failed'
      );

      throw new UnauthorizedException(
        'Refresh session rotation failed'
      );
    }

    return {
      refreshToken:
        prepared.refreshToken,
      sessionId:
        prepared.sessionId,
      familyId:
        prepared.familyId,
    };
  }

  async revoke(
    identity:
      AuthenticatedRefreshRequestUser,
    presentedToken:
      string
  ): Promise<void> {
    const current =
      await this.sessions
        .findOne({
          userId:
            new Types.ObjectId(
              identity.userId
            ),
          sessionId:
            identity.sessionId,
          familyId:
            identity.familyId,
          tokenHash:
            this.hashToken(
              presentedToken
            ),
        })
        .exec();

    if (!current) {
      return;
    }

    await this.revokeFamily(
      identity.familyId,
      'logout'
    );
  }

  private async prepare(
    principal:
      RefreshSessionPrincipal,
    familyId:
      string
  ): Promise<PreparedRefreshSession> {
    const sessionId =
      randomUUID();

    const payload:
      RefreshTokenPayload = {
        sub:
          principal.userId,
        username:
          principal.username,
        role:
          principal.role,
        typ:
          'refresh',
        sid:
          sessionId,
        fid:
          familyId,
      };

    const refreshToken =
      await this.jwtService
        .signAsync(
          payload,
          {
            secret:
              this.refreshSecret,
            expiresIn:
              REFRESH_TOKEN_SECONDS,
          }
        );

    return {
      refreshToken,
      sessionId,
      familyId,
      record: {
        userId:
          new Types.ObjectId(
            principal.userId
          ),
        sessionId,
        familyId,
        tokenHash:
          this.hashToken(
            refreshToken
          ),
        expiresAt:
          new Date(
            Date.now() +
              REFRESH_TOKEN_SECONDS *
                1000
          ),
      },
    };
  }

  private async revokeFamily(
    familyId:
      string,
    reason:
      RefreshSessionRevokeReason
  ): Promise<void> {
    await this.sessions
      .updateMany(
        {
          familyId,
          revokedAt:
            null,
        },
        {
          $set: {
            revokedAt:
              new Date(),
            revokeReason:
              reason,
          },
        }
      )
      .exec();
  }

  private hashToken(
    token:
      string
  ): string {
    return createHash(
      'sha256'
    )
      .update(token)
      .digest('hex');
  }
}
