import {
  ConflictException,
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
  Model,
} from 'mongoose';
import {
  from,
  Observable,
} from 'rxjs';
import {
  map,
  switchMap,
} from 'rxjs/operators';
import {
  User,
  UserDocument,
} from '../schemas/user.schema';
import {
  ACCESS_TOKEN_SECONDS,
  AccessTokenPayload,
  AuthenticatedRefreshRequestUser,
  AuthUserRole,
  normalizeAuthRole,
  requireIndependentAuthSecrets,
} from './auth-token.config';
import {
  LoginDto,
} from './dto/login.dto';
import {
  RegisterDto,
} from './dto/register.dto';
import {
  RefreshSessionPrincipal,
  RefreshSessionService,
} from './refresh-session.service';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: AuthUserRole;
  createdAt: string;
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface AuthResponse
  extends AccessTokenResponse {
  user: AuthUser;
}

export interface IssuedAuthSession {
  response:
    AuthResponse;
  refreshToken:
    string;
}

export interface RotatedAuthSession {
  response:
    AccessTokenResponse;
  refreshToken:
    string;
}

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  role: AuthUserRole;
}

export interface CleanupTestUserResult {
  message: string;
  deletedCount: number;
  success: boolean;
}

@Injectable()
export class AuthService {
  private readonly accessSecret:
    string;

  constructor(
    @InjectModel(User.name)
    private readonly userModel:
      Model<UserDocument>,

    private readonly jwtService:
      JwtService,

    private readonly refreshSessions:
      RefreshSessionService,

    configService:
      ConfigService
  ) {
    this.accessSecret =
      requireIndependentAuthSecrets(
        configService
      ).access;
  }

  register(
    registerDto:
      RegisterDto
  ): Observable<IssuedAuthSession> {
    return from(
      this.userModel.findOne({
        $or: [
          {
            email:
              registerDto.email
                .toLowerCase(),
          },
          {
            username:
              registerDto.username,
          },
        ],
      })
    ).pipe(
      map(
        (existingUser) => {
          if (existingUser) {
            if (
              existingUser.email ===
              registerDto.email
                .toLowerCase()
            ) {
              throw new ConflictException(
                'Email already registered'
              );
            }

            throw new ConflictException(
              'Username already taken'
            );
          }

          return new this.userModel({
            email:
              registerDto.email
                .toLowerCase(),
            username:
              registerDto.username,
            password:
              registerDto.password,
            role:
              'user',
          });
        }
      ),

      switchMap(
        (user) =>
          from(
            user.save()
          )
      ),

      switchMap(
        (user) =>
          from(
            this.createAuthSession(
              user
            )
          )
      )
    );
  }

  login(
    loginDto:
      LoginDto
  ): Observable<IssuedAuthSession> {
    const identifier =
      loginDto
        .emailOrUsername
        .toLowerCase();

    return from(
      this.userModel.findOne({
        $or: [
          {
            email:
              identifier,
          },
          {
            username:
              loginDto
                .emailOrUsername,
          },
        ],
      })
    ).pipe(
      map(
        (user) => {
          if (!user) {
            throw new UnauthorizedException(
              'Invalid credentials'
            );
          }

          return user;
        }
      ),

      switchMap(
        (user) =>
          from(
            user.comparePassword(
              loginDto.password
            )
          ).pipe(
            map(
              (valid) => {
                if (!valid) {
                  throw new UnauthorizedException(
                    'Invalid credentials'
                  );
                }

                return user;
              }
            )
          )
      ),

      switchMap(
        (user) =>
          from(
            this.createAuthSession(
              user
            )
          )
      )
    );
  }

  refresh(
    identity:
      AuthenticatedRefreshRequestUser,
    presentedToken:
      string
  ): Observable<RotatedAuthSession> {
    return from(
      this.createAccessToken(
        identity
      )
    ).pipe(
      switchMap(
        (accessToken) =>
          from(
            this.refreshSessions
              .rotate(
                identity,
                presentedToken
              )
          ).pipe(
            map(
              (rotated) => ({
                response: {
                  accessToken,
                  expiresIn:
                    ACCESS_TOKEN_SECONDS,
                },
                refreshToken:
                  rotated.refreshToken,
              })
            )
          )
      )
    );
  }

  logout(
    identity:
      AuthenticatedRefreshRequestUser,
    presentedToken:
      string
  ): Observable<void> {
    return from(
      this.refreshSessions.revoke(
        identity,
        presentedToken
      )
    );
  }

  validateSession(
    userId:
      string
  ): Observable<SessionUser | null> {
    return from(
      this.userModel.findById(
        userId
      )
    ).pipe(
      map(
        (user) => {
          if (!user) {
            return null;
          }

          return {
            id:
              user._id.toString(),
            email:
              user.email,
            username:
              user.username,
            role:
              normalizeAuthRole(
                user.role
              ),
          };
        }
      )
    );
  }

  cleanupTestUser(
    email:
      string
  ): Observable<CleanupTestUserResult> {
    if (
      process.env.NODE_ENV !==
      'test'
    ) {
      throw new Error(
        'Test user cleanup only allowed in test environment'
      );
    }

    return from(
      this.userModel.deleteOne({
        email:
          email.toLowerCase(),
      }).exec()
    ).pipe(
      map(
        (result) => ({
          message:
            `Test user ${email} cleanup completed`,
          deletedCount:
            result.deletedCount || 0,
          success:
            true,
        })
      )
    );
  }

  private async createAuthSession(
    user:
      UserDocument
  ): Promise<IssuedAuthSession> {
    const principal =
      this.toPrincipal(
        user
      );

    const accessToken =
      await this.createAccessToken(
        principal
      );

    const refresh =
      await this.refreshSessions
        .issue(
          principal
        );

    return {
      response: {
        user:
          this.toAuthUser(
            user
          ),
        accessToken,
        expiresIn:
          ACCESS_TOKEN_SECONDS,
      },
      refreshToken:
        refresh.refreshToken,
    };
  }

  private async createAccessToken(
    principal:
      RefreshSessionPrincipal
  ): Promise<string> {
    const payload:
      AccessTokenPayload = {
        sub:
          principal.userId,
        username:
          principal.username,
        role:
          principal.role,
        typ:
          'access',
      };

    return this.jwtService
      .signAsync(
        payload,
        {
          secret:
            this.accessSecret,
          expiresIn:
            ACCESS_TOKEN_SECONDS,
        }
      );
  }

  private toPrincipal(
    user:
      UserDocument
  ): RefreshSessionPrincipal {
    return {
      userId:
        user._id.toString(),
      username:
        user.username,
      role:
        normalizeAuthRole(
          user.role
        ),
    };
  }

  private toAuthUser(
    user:
      UserDocument
  ): AuthUser {
    return {
      id:
        user._id.toString(),
      email:
        user.email,
      username:
        user.username,
      role:
        normalizeAuthRole(
          user.role
        ),
      createdAt:
        user.createdAt
          .toISOString(),
    };
  }
}
