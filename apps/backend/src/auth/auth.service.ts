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
  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      $or: [
        { email: registerDto.email.toLowerCase() },
        { username: registerDto.username },
      ],
    });

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

    await user.save();

    // Generate JWT tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  /**
   * Login existing user
   *
   * @param loginDto - Login credentials (email/username and password)
   * @returns User object and JWT tokens
   * @throws UnauthorizedException if credentials invalid
   */
  async login(loginDto: LoginDto) {
    // Find user by email or username
    const identifier = loginDto.emailOrUsername.toLowerCase();
    const user = await this.userModel.findOne({
      $or: [
        { email: identifier },
        { username: loginDto.emailOrUsername }, // Username is case-sensitive
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password using instance method
    const isPasswordValid = await user.comparePassword(loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token
   *
   * @param userId - User ID from refresh token payload
   * @returns New access and refresh tokens
   * @throws UnauthorizedException if user not found
   */
  async refresh(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user);
    return tokens;
  }

  /**
   * Validate user session
   *
   * @param userId - User ID from JWT token
   * @returns User object if valid, null otherwise
   */
  async validateSession(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role,
    };
  }

  /**
   * Generate JWT access and refresh tokens
   *
   * @param user - User document
   * @returns Object with accessToken and refreshToken
   * @private
   */
  private async generateTokens(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Cleanup test user (E2E testing only)
   *
   * Removes test user from database. Only works in test environment.
   *
   * @param email - Email of test user to remove
   * @returns Success message
   */
  async cleanupTestUser(email: string) {
    // Only allow in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Test user cleanup only allowed in test environment');
    }

    const result = await this.userModel.deleteOne({
      email: email.toLowerCase(),
    });

    return {
      message: `Test user ${email} cleanup completed`,
      deletedCount: result.deletedCount,
      success: true,
    };
  }
}
