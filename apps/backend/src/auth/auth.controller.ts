import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Throttle,
  ThrottlerGuard,
} from '@nestjs/throttler';
import {
  map,
} from 'rxjs/operators';
import {
  AuthenticatedRefreshRequestUser,
  AuthenticatedRequestUser,
} from './auth-token.config';
import {
  AuthService,
} from './auth.service';
import {
  clearRefreshCookie,
  RefreshCookieResponse,
  requireRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import {
  LoginDto,
} from './dto/login.dto';
import {
  RegisterDto,
} from './dto/register.dto';
import {
  JwtAuthGuard,
} from './guards/jwt-auth.guard';
import {
  RefreshJwtAuthGuard,
} from './guards/refresh-jwt-auth.guard';

interface AccessRequest {
  user:
    AuthenticatedRequestUser;
}

interface RefreshRequest {
  user:
    AuthenticatedRefreshRequestUser;
}

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit:
        5,
      ttl:
        60_000,
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Register new user account',
  })
  @ApiResponse({
    status:
      201,
    description:
      'Account created and refresh session established',
  })
  register(
    @Body()
    registerDto:
      RegisterDto,

    @Res({
      passthrough:
        true,
    })
    response:
      RefreshCookieResponse
  ) {
    return this.authService
      .register(
        registerDto
      )
      .pipe(
        map(
          (session) => {
            setRefreshCookie(
              response,
              session.refreshToken
            );

            return session.response;
          }
        )
      );
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit:
        5,
      ttl:
        60_000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Authenticate user',
  })
  @ApiResponse({
    status:
      200,
    description:
      'Authenticated and refresh session established',
  })
  login(
    @Body()
    loginDto:
      LoginDto,

    @Res({
      passthrough:
        true,
    })
    response:
      RefreshCookieResponse
  ) {
    return this.authService
      .login(
        loginDto
      )
      .pipe(
        map(
          (session) => {
            setRefreshCookie(
              response,
              session.refreshToken
            );

            return session.response;
          }
        )
      );
  }

  @Post('refresh')
  @UseGuards(
    ThrottlerGuard,
    RefreshJwtAuthGuard
  )
  @Throttle({
    default: {
      limit:
        20,
      ttl:
        60_000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rotate refresh session',
  })
  refresh(
    @Request()
    request:
      RefreshRequest,

    @Headers('cookie')
    cookieHeader:
      string | undefined,

    @Res({
      passthrough:
        true,
    })
    response:
      RefreshCookieResponse
  ) {
    const presentedToken =
      requireRefreshCookie(
        cookieHeader
      );

    return this.authService
      .refresh(
        request.user,
        presentedToken
      )
      .pipe(
        map(
          (session) => {
            setRefreshCookie(
              response,
              session.refreshToken
            );

            return session.response;
          }
        )
      );
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Validate current access session',
  })
  checkSession(
    @Request()
    request:
      AccessRequest
  ) {
    return this.authService
      .validateSession(
        request.user.userId
      );
  }

  @Post('logout')
  @UseGuards(
    RefreshJwtAuthGuard
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Revoke refresh session',
  })
  logout(
    @Request()
    request:
      RefreshRequest,

    @Headers('cookie')
    cookieHeader:
      string | undefined,

    @Res({
      passthrough:
        true,
    })
    response:
      RefreshCookieResponse
  ) {
    const presentedToken =
      requireRefreshCookie(
        cookieHeader
      );

    return this.authService
      .logout(
        request.user,
        presentedToken
      )
      .pipe(
        map(
          () => {
            clearRefreshCookie(
              response
            );

            return {
              message:
                'Logged out successfully',
              success:
                true,
            };
          }
        )
      );
  }

  @Delete('test-user/:email')
  @HttpCode(HttpStatus.OK)
  async cleanupTestUser(
    @Param('email')
    email:
      string
  ) {
    if (
      process.env.NODE_ENV !==
      'test'
    ) {
      throw new Error(
        'Test user cleanup only allowed in test environment'
      );
    }

    return this.authService
      .cleanupTestUser(
        email
      );
  }
}
