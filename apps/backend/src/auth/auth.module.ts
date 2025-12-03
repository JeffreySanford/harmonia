import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User, UserSchema } from '../schemas/user.schema';

/**
 * Auth Module
 * 
 * Provides complete authentication functionality including:
 * - User registration and login
 * - JWT token generation and validation
 * - Password hashing and comparison
 * - Session validation
 * 
 * **Exports**:
 * - AuthService - For use in other modules (e.g., checking user roles)
 * 
 * **Dependencies**:
 * - PassportModule - For authentication strategies
 * - JwtModule - For token generation/verification
 * - MongooseModule - For User model access
 * - ConfigModule - For JWT_SECRET environment variable
 * 
 * **Routes**:
 * All routes prefixed with `/auth`:
 * - POST /auth/register
 * - POST /auth/login
 * - POST /auth/refresh
 * - GET /auth/session
 * - POST /auth/logout
 * 
 * @see {@link file://./../../docs/AUTHENTICATION_SYSTEM.md} for complete documentation
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-change-in-production',
        signOptions: { 
          expiresIn: '15m', // Default expiration for access tokens
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService], // Export for use in other modules
})
export class AuthModule {}
