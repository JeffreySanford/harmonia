import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaService } from '../llm/ollama.service';
import { SongsController } from './songs.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SongsController],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class SongsModule {}

export default SongsModule;
