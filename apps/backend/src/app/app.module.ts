import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JobsGateway } from './gateways/jobs.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, JobsGateway],
})
export class AppModule {}
