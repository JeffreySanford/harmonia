import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { MusicRuntimeService } from './music-runtime.service';

class SelectMusicModelDto {
  @IsString()
  @IsNotEmpty()
  modelId!: string;
}

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
  selectModel(@Body() body: SelectMusicModelDto) {
    return this.runtime.selectModel(body.modelId);
  }

  @Post('stop')
  stopRuntime() {
    return this.runtime.stopCurrentRuntime();
  }
}
