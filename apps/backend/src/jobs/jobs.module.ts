import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsGateway } from '../app/gateways/jobs.gateway';
import {
  JobRecord,
  JobRecordSchema,
} from '../schemas/job-record.schema';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { MusicRuntimeModule } from '../music-runtime/music-runtime.module';

@Module({
  imports: [
    MusicRuntimeModule,
    MongooseModule.forFeature([
      { name: JobRecord.name, schema: JobRecordSchema },
    ]),
  ],
  controllers: [JobsController],
  providers: [JobsGateway, JobsService],
  exports: [JobsService, JobsGateway],
})
export class JobsModule {}
