import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MusicRuntimeController } from './music-runtime.controller';
import { MusicRuntimeGateway } from './music-runtime.gateway';
import { MusicRuntimeService } from './music-runtime.service';
import { ModelInstallationRuntimeService } from './model-installation-runtime.service';
import {
  ModelInstallation,
  ModelInstallationSchema,
} from '../schemas/model-installation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModelInstallation.name, schema: ModelInstallationSchema },
    ]),
  ],
  controllers: [MusicRuntimeController],
  providers: [MusicRuntimeGateway, ModelInstallationRuntimeService, MusicRuntimeService],
  exports: [MusicRuntimeService],
})
export class MusicRuntimeModule {}
