import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaService } from '../llm/ollama.service';
import { SongsController } from './songs.controller';
import { MmslParserService } from './mmsl-parser.service';
import { StemExportService } from './stem-export.service';

@Module({
  imports: [ConfigModule],
  controllers: [SongsController],
  providers: [OllamaService, MmslParserService, StemExportService],
  exports: [OllamaService, MmslParserService, StemExportService],
})
export class SongsModule {}

export default SongsModule;
