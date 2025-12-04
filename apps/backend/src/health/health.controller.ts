import { Controller, Get } from '@nestjs/common';

@Controller('__health')
export class HealthController {
  @Get()
  status() {
    return { ok: true };
  }
}

// Named export only: do not default-export controllers for Nest DI
