import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MusicRuntimeService } from './music-runtime.service';

class SelectMusicModelDto {
  @IsString()
  @IsNotEmpty()
  modelId!: string;
}

@Controller('music/runtime')
export class MusicRuntimeController {
  constructor(
    private readonly runtime: MusicRuntimeService
  ) {}

  @Get('catalog')
  getCatalog() {
    return this.runtime.getCatalog();
  }

  @Get('status')
  getStatus() {
    return this.runtime.getStatus();
  }

  @Post('select')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.ACCEPTED)
  selectModel(
    @Body() body: SelectMusicModelDto
  ) {
    return this.runtime
      .requestModelSelection(body.modelId);
  }

  @Post('stop')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  stopRuntime() {
    return this.runtime.stopCurrentRuntime();
  }
}
