import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '../auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsGateway } from '../app/gateways/jobs.gateway';
import {
  JobRecord,
  JobRecordSchema,
} from '../schemas/job-record.schema';
import {
  User,
  UserSchema,
} from '../schemas/user.schema';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { MusicRuntimeModule } from '../music-runtime/music-runtime.module';

@Module({
  imports: [
    AuthModule,
    MusicRuntimeModule,
    BullModule.registerQueue({
      name: 'generation',
    }),
    MongooseModule.forFeature([
      {
        name: JobRecord.name,
        schema: JobRecordSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
  ],
  controllers: [JobsController],
  providers: [JobsGateway, JobsService],
  exports: [JobsService, JobsGateway],
})
export class JobsModule {}
