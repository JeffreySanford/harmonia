import { Module } from '@nestjs/common';
import { MusicRuntimeController } from './music-runtime.controller';
import { MusicRuntimeGateway } from './music-runtime.gateway';
import { MusicRuntimeService } from './music-runtime.service';

@Module({
  controllers: [MusicRuntimeController],
  providers: [MusicRuntimeGateway, MusicRuntimeService],
  exports: [MusicRuntimeService],
})
export class MusicRuntimeModule {}
