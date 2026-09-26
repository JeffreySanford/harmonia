import {
  Module,
} from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import {
  JwtModule,
} from '@nestjs/jwt';
import {
  MongooseModule,
} from '@nestjs/mongoose';
import {
  PassportModule,
} from '@nestjs/passport';
import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import {
  RefreshSession,
  RefreshSessionSchema,
} from '../schemas/refresh-session.schema';
import {
  User,
  UserSchema,
} from '../schemas/user.schema';
import {
  ACCESS_TOKEN_SECONDS,
  requireAuthSecret,
} from './auth-token.config';
import {
  AuthController,
} from './auth.controller';
import {
  AuthService,
} from './auth.service';
import {
  RefreshSessionService,
} from './refresh-session.service';
import {
  JwtStrategy,
} from './strategies/jwt.strategy';
import {
  RefreshJwtStrategy,
} from './strategies/refresh-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy:
        'jwt',
    }),

    ThrottlerModule.forRoot([
      {
        ttl:
          60_000,
        limit:
          100,
      },
    ]),

    JwtModule.registerAsync({
      imports: [
        ConfigModule,
      ],
      inject: [
        ConfigService,
      ],
      useFactory: (
        configService:
          ConfigService
      ) => ({
        secret:
          requireAuthSecret(
            configService,
            'JWT_SECRET'
          ),
        signOptions: {
          expiresIn:
            ACCESS_TOKEN_SECONDS,
        },
      }),
    }),

    MongooseModule.forFeature([
      {
        name:
          User.name,
        schema:
          UserSchema,
      },
      {
        name:
          RefreshSession.name,
        schema:
          RefreshSessionSchema,
      },
    ]),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    RefreshSessionService,
    JwtStrategy,
    RefreshJwtStrategy,
    ThrottlerGuard,
  ],

  exports: [
    AuthService,
    JwtModule,
  ],
})
export class AuthModule {}
