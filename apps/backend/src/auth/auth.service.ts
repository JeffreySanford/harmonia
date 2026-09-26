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
  AuthTokenPayload,
  AuthUserRole,
  normalizeAuthRole,
  REFRESH_TOKEN_SECONDS,
  requireIndependentAuthSecrets,
} from './auth-token.config';
import {
  LoginDto,
} from './dto/login.dto';
import {
  RegisterDto,
} from './dto/register.dto';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: AuthUserRole;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse
  extends AuthTokens
{
  user: AuthUser;
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

  private readonly refreshSecret:
    string;

  constructor(
    @InjectModel(User.name)
    private readonly userModel:
      Model<UserDocument>,

    private readonly jwtService:
      JwtService,

    configService:
      ConfigService
  ) {
    const secrets =
      requireIndependentAuthSecrets(
        configService
      );

    this.accessSecret =
      secrets.access;

    this.refreshSecret =
      secrets.refresh;
  }

  register(
    registerDto:
      RegisterDto
  ): Observable<AuthResponse> {
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
            this.createAuthResponse(
              user
            )
          )
      )
    );
  }

  login(
    loginDto:
      LoginDto
  ): Observable<AuthResponse> {
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
            this.createAuthResponse(
              user
            )
          )
      )
    );
  }

  refresh(
    userId: string
  ): Observable<AuthTokens> {
    return from(
      this.userModel
        .findById(
          userId
        )
    ).pipe(
      map(
        (user) => {
          if (!user) {
            throw new UnauthorizedException(
              'User not found'
            );
          }

          return user;
        }
      ),

      switchMap(
        (user) =>
          from(
            this.createTokens(
              user
            )
          )
      )
    );
  }

  validateSession(
    userId: string
  ): Observable<SessionUser | null> {
    return from(
      this.userModel
        .findById(
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
    email: string
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

  private async createAuthResponse(
    user:
      UserDocument
  ): Promise<AuthResponse> {
    const tokens =
      await this.createTokens(
        user
      );

    return {
      user:
        this.toAuthUser(
          user
        ),
      ...tokens,
    };
  }

  private async createTokens(
    user:
      UserDocument
  ): Promise<AuthTokens> {
    const role =
      normalizeAuthRole(
        user.role
      );

    const accessPayload:
      AuthTokenPayload = {
        sub:
          user._id.toString(),
        username:
          user.username,
        role,
        typ:
          'access',
      };

    const refreshPayload:
      AuthTokenPayload = {
        sub:
          user._id.toString(),
        username:
          user.username,
        role,
        typ:
          'refresh',
      };

    const [
      accessToken,
      refreshToken,
    ] =
      await Promise.all([
        this.jwtService
          .signAsync(
            accessPayload,
            {
              secret:
                this.accessSecret,
              expiresIn:
                ACCESS_TOKEN_SECONDS,
            }
          ),

        this.jwtService
          .signAsync(
            refreshPayload,
            {
              secret:
                this.refreshSecret,
              expiresIn:
                REFRESH_TOKEN_SECONDS,
            }
          ),
      ]);

    return {
      accessToken,
      refreshToken,
      expiresIn:
        ACCESS_TOKEN_SECONDS,
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
