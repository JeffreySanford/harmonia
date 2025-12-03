import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';

/**
 * JWT Strategy
 * 
 * Passport strategy for JWT token validation.
 * 
 * **Configuration**:
 * - Extracts JWT from Authorization header (Bearer token)
 * - Uses JWT_SECRET from environment variables
 * - Does not ignore token expiration
 * 
 * **Validation**:
 * 1. Extracts payload from JWT
 * 2. Looks up user by ID (payload.sub)
 * 3. Returns user object if found
 * 4. Throws UnauthorizedException if user not found
 * 
 * **Usage**:
 * Attach JwtAuthGuard to routes that require authentication.
 * 
 * @see {@link file://./../../guards/jwt-auth.guard.ts} for guard implementation
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-change-in-production',
    });
  }

  /**
   * Validate JWT payload and return user object
   * 
   * @param payload - Decoded JWT payload with sub (user ID), username, role
   * @returns User object attached to request.user
   * @throws UnauthorizedException if user not found in database
   */
  async validate(payload: { sub: string; username: string; role: string }) {
    const user = await this.userModel.findById(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return user object (attached to request.user by Passport)
    return { 
      userId: user._id.toString(), 
      username: user.username, 
      email: user.email, 
      role: user.role 
    };
  }
}
