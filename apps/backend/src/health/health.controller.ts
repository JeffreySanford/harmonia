import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('__health')
@ApiTags('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Basic health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
  })
  status() {
    return { ok: true };
  }
}

// Named export only: do not default-export controllers for Nest DI
