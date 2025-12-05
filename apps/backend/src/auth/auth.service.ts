import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

/**
 * Auth Service
 *
 * Handles all authentication logic including:
 * - User registration with password hashing
 * - User login with credential validation
 * - JWT token generation (access + refresh)
 * - Token refresh
 * - Session validation
 *
 * **Token Strategy**:
 * - Access Token: 15 minutes expiration
 * - Refresh Token: 7 days expiration
 * - Tokens contain: userId (sub), username, role
 *
 * **Security**:
 * - Passwords hashed with bcrypt (10 rounds) via User schema pre-save hook
 * - Email/username uniqueness enforced at database level
 * - Login attempts limited by rate limiting (TODO: implement)
 *
 * @see {@link file://./../../docs/AUTHENTICATION_SYSTEM.md} for complete architecture
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService
  ) {}

  /**
   * Register new user
   *
   * @param registerDto - User registration data (email, username, password)
   * @returns User object and JWT tokens
   * @throws ConflictException if email or username already exists
   */
  register(registerDto: RegisterDto): Observable<any> {
    return from(
      this.userModel.findOne({
        $or: [
          { email: registerDto.email.toLowerCase() },
          { username: registerDto.username },
        ],
      })
    ).pipe(
      map((existingUser) => {
        if (existingUser) {
          if (existingUser.email === registerDto.email.toLowerCase()) {
            throw new ConflictException('Email already registered');
          }
          if (existingUser.username === registerDto.username) {
            throw new ConflictException('Username already taken');
          }
        }

        // Create new user (password will be hashed by pre-save hook)
        const user = new this.userModel({
          email: registerDto.email.toLowerCase(),
          username: registerDto.username,
          password: registerDto.password,
          role: 'user', // Default role
        });

        return user;
      }),
      switchMap((user) => from(user.save())),
      switchMap((user) => {
        return from(this.generateTokens(user)).pipe(
          map((tokens) => ({ user, tokens }))
        );
      }),
      map(({ user, tokens }) => ({
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      })),
      catchError((error) => {
        throw error; // Re-throw to maintain error propagation
      })
    );
  }

  /**
   * Login existing user
   *
   * @param loginDto - Login credentials (email/username and password)
   * @returns User object and JWT tokens
   * @throws UnauthorizedException if credentials invalid
   */
  login(loginDto: LoginDto): Observable<any> {
    // Find user by email or username
    const identifier = loginDto.emailOrUsername.toLowerCase();
    return from(
      this.userModel.findOne({
        $or: [
          { email: identifier },
          { username: loginDto.emailOrUsername }, // Username is case-sensitive
        ],
      })
    ).pipe(
      map((user) => {
        if (!user) {
          throw new UnauthorizedException('Invalid credentials');
        }
        return user;
      }),
      switchMap((user) =>
        from(user.comparePassword(loginDto.password)).pipe(
          map((isPasswordValid) => {
            if (!isPasswordValid) {
              throw new UnauthorizedException('Invalid credentials');
            }
            return user;
          })
        )
      ),
      switchMap((user) =>
        from(this.generateTokens(user)).pipe(
          map((tokens) => ({ user, tokens }))
        )
      ),
      map(({ user, tokens }) => ({
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      })),
      catchError((error) => {
        throw error; // Re-throw to maintain error propagation
      })
    );
  }

  /**
   * Refresh access token
   *
   * @param userId - User ID from refresh token payload
   * @returns New access and refresh tokens
   * @throws UnauthorizedException if user not found
   */
  refresh(userId: string): Observable<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    return from(this.userModel.findById(userId)).pipe(
      map((user) => {
        if (!user) {
          throw new UnauthorizedException('User not found');
        }
        return user;
      }),
      switchMap((user) => from(this.generateTokens(user))),
      catchError((error) => {
        throw error; // Re-throw to maintain error propagation
      })
    );
  }

  /**
   * Validate user session
   *
   * @param userId - User ID from JWT token
   * @returns User object if valid, null otherwise
   */
  validateSession(userId: string): Observable<any> {
    return from(this.userModel.findById(userId)).pipe(
      map((user) => {
        if (!user) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          role: user.role,
        };
      }),
      catchError((error) => {
        throw error; // Re-throw to maintain error propagation
      })
    );
  }

  /**
   * Generate JWT access and refresh tokens
   *
   * @param user - User document
   * @returns Object with accessToken and refreshToken
   * @private
   */
  private generateTokens(user: UserDocument): Observable<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const payload = {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    return from(
      Promise.all([
        this.jwtService.signAsync(payload, { expiresIn: '15m' }),
        this.jwtService.signAsync(payload, { expiresIn: '7d' }),
      ])
    ).pipe(
      map(([accessToken, refreshToken]) => ({
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      })),
      catchError((error) => {
        throw error; // Re-throw to maintain error propagation
      })
    );
  }

  /**
   * Cleanup test user (E2E testing only)
   *
   * Removes test user from database. Only works in test environment.
   *
   * @param email - Email of test user to remove
   * @returns Success message
   */
  cleanupTestUser(
    email: string
  ): Observable<{ message: string; deletedCount: number; success: boolean }> {
    // Only allow in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Test user cleanup only allowed in test environment');
    }

    return from(
      this.userModel.deleteOne({
        email: email.toLowerCase(),
      })
    ).pipe(
      map((result: any) => ({
        message: `Test user ${email} cleanup completed`,
        deletedCount: result.deletedCount || 0,
        success: true,
      })),
      catchError((error) => {
        throw error; // Re-throw to maintain error propagation
      })
    );
  }
}
