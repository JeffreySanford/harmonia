import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaService } from '../llm/ollama.service';
import { SongsController } from './songs.controller';
import { MmslParserService } from './mmsl-parser.service';
import { StemExportService } from './stem-export.service';
import { SongDslParserService } from './song-dsl-parser.service';
import { InstrumentCatalogService } from './instrument-catalog.service';
import { LyricAnalysisService } from './lyric-analysis.service';

@Module({
  imports: [ConfigModule],
  controllers: [SongsController],
  providers: [
    OllamaService,
    MmslParserService,
    StemExportService,
    SongDslParserService,
    InstrumentCatalogService,
    LyricAnalysisService,
  ],
  exports: [
    OllamaService,
    MmslParserService,
    StemExportService,
    SongDslParserService,
    InstrumentCatalogService,
    LyricAnalysisService,
  ],
})
export class SongsModule {}
