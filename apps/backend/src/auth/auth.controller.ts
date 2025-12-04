import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Auth Controller
 *
 * REST API endpoints for authentication.
 *
 * **Endpoints**:
 * - POST /auth/register - Register new user
 * - POST /auth/login - Login with credentials
 * - POST /auth/refresh - Refresh access token
 * - GET /auth/session - Validate current session
 * - POST /auth/logout - Logout user (stateless)
 *
 * **Authentication**:
 * - /register and /login are public
 * - /refresh, /session, /logout require valid JWT (JwtAuthGuard)
 *
 * **Response Format**:
 * ```json
 * {
 *   "user": {
 *     "id": "507f1f77bcf86cd799439011",
 *     "email": "user@example.com",
 *     "username": "johndoe",
 *     "role": "user"
 *   },
 *   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresIn": 900
 * }
 * ```
 *
 * @see {@link file://./../../docs/AUTHENTICATION_SYSTEM.md} for API specification
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register new user
   *
   * POST /api/auth/register
   *
   * @param registerDto - Registration data (email, username, password)
   * @returns User object and JWT tokens
   * @throws 409 Conflict if email/username exists
   * @throws 400 Bad Request if validation fails
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    // Debug logging in development/test only (mask sensitive fields)
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      const safe = { email: registerDto.email, username: registerDto.username };
      console.debug('[AuthController.register] register payload:', safe);
    }
    const result = await this.authService.register(registerDto);
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      console.debug(
        '[AuthController.register] result keys:',
        Object.keys(result)
      );
    }
    return result;
  }

  /**
   * Login with credentials
   *
   * POST /api/auth/login
   *
   * @param loginDto - Login credentials (emailOrUsername, password)
   * @returns User object and JWT tokens
   * @throws 401 Unauthorized if credentials invalid
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      const safe = { emailOrUsername: loginDto.emailOrUsername };
      console.debug('[AuthController.login] login payload:', safe);
    }
    const result = await this.authService.login(loginDto);
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      console.debug('[AuthController.login] result keys:', Object.keys(result));
    }
    return result;
  }

  /**
   * Refresh access token
   *
   * POST /api/auth/refresh
   * Requires: Authorization Bearer <refresh_token>
   *
   * @param req - Request object with user from JWT
   * @returns New access and refresh tokens
   * @throws 401 Unauthorized if token invalid
   */
  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: { user: { userId: string } }) {
    return this.authService.refresh(req.user.userId);
  }

  /**
   * Validate current session
   *
   * GET /api/auth/session
   * Requires: Authorization Bearer <access_token>
   *
   * @param req - Request object with user from JWT
   * @returns User object if session valid
   * @throws 401 Unauthorized if token invalid
   */
  @Get('session')
  @UseGuards(JwtAuthGuard)
  async checkSession(@Request() req: { user: { userId: string } }) {
    return this.authService.validateSession(req.user.userId);
  }

  /**
   * Logout user
   *
   * POST /api/auth/logout
   * Requires: Authorization Bearer <access_token>
   *
   * For stateless JWT authentication, logout is handled client-side
   * by removing tokens from storage. This endpoint exists for:
   * - Future Redis session invalidation
   * - Audit logging
   * - Consistent API design
   *
   * @returns Success message
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout() {
    // For stateless JWT, logout is client-side (remove token from storage)
    // If using Redis sessions, invalidate session here:
    // await this.redisService.delete(`session:${req.user.userId}`);

    return {
      message: 'Logged out successfully',
      success: true,
    };
  }

  /**
   * Cleanup test user (E2E testing only)
   *
   * DELETE /api/auth/test-user/:email
   *
   * Removes test user from database. Only works in test environment.
   *
   * @param email - Email of test user to remove
   * @returns Success message
   */
  @Delete('test-user/:email')
  @HttpCode(HttpStatus.OK)
  async cleanupTestUser(@Param('email') email: string) {
    // Only allow in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Test user cleanup only allowed in test environment');
    }

    return this.authService.cleanupTestUser(email);
  }
}
