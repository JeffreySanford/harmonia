import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard
 * 
 * Route guard that requires valid JWT authentication.
 * 
 * **Usage**:
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * async getProfile(@Request() req) {
 *   return req.user; // { userId, username, email, role }
 * }
 * ```
 * 
 * **Behavior**:
 * - Extracts JWT from Authorization header
 * - Validates token signature and expiration
 * - Calls JwtStrategy.validate() to load user
 * - Attaches user object to request.user
 * - Returns 401 Unauthorized if token invalid/missing
 * 
 * @see {@link file://./../../strategies/jwt.strategy.ts} for validation logic
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
