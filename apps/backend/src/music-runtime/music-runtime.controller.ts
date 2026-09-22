import { Body, Controller, Get, Post } from '@nestjs/common';
import { MusicRuntimeService } from './music-runtime.service';

@Controller('music/runtime')
export class MusicRuntimeController {
  constructor(private readonly runtime: MusicRuntimeService) {}

  @Get('catalog')
  getCatalog() {
    return this.runtime.getCatalog();
  }

  @Get('status')
  getStatus() {
    return this.runtime.getStatus();
  }

  @Post('select')
  selectModel(@Body() body: { modelId: string }) {
    return this.runtime.selectModel(body.modelId);
  }

  @Post('stop')
  stopRuntime() {
    return this.runtime.stopCurrentRuntime();
  }
}
