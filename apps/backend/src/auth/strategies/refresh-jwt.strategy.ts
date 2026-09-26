import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import {
  InjectModel,
} from '@nestjs/mongoose';
import {
  PassportStrategy,
} from '@nestjs/passport';
import {
  Model,
} from 'mongoose';
import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';
import {
  User,
  UserDocument,
} from '../../schemas/user.schema';
import {
  AuthenticatedRequestUser,
  AuthTokenPayload,
  normalizeAuthRole,
  requireAuthSecret,
} from '../auth-token.config';

@Injectable()
export class RefreshJwtStrategy
  extends PassportStrategy(
    Strategy,
    'jwt-refresh'
  )
{
  constructor(
    configService:
      ConfigService,

    @InjectModel(User.name)
    private readonly userModel:
      Model<UserDocument>
  ) {
    super({
      jwtFromRequest:
        ExtractJwt
          .fromAuthHeaderAsBearerToken(),
      ignoreExpiration:
        false,
      secretOrKey:
        requireAuthSecret(
          configService,
          'JWT_REFRESH_SECRET'
        ),
    });
  }

  async validate(
    payload:
      AuthTokenPayload
  ): Promise<AuthenticatedRequestUser> {
    if (
      payload.typ !==
      'refresh'
    ) {
      throw new UnauthorizedException(
        'Refresh token required'
      );
    }

    const user =
      await this.userModel
        .findById(
          payload.sub
        );

    if (!user) {
      throw new UnauthorizedException(
        'User not found'
      );
    }

    return {
      userId:
        user._id.toString(),
      username:
        user.username,
      email:
        user.email,
      role:
        normalizeAuthRole(
          user.role
        ),
    };
  }
}
