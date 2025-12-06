import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JobsGateway } from './gateways/jobs.gateway';
import { HealthController } from '../health/health.controller';
import { AuthModule } from '../auth/auth.module';
import { SongsModule } from '../songs/songs.module';
import { LibraryModule } from '../library/library.module';
import { ProfileModule } from '../profile/profile.module';

/**
 * App Module
 *
 * Root application module for Harmonia backend.
 *
 * **Features**:
 * - ConfigModule (global) - Environment variable management
 * - MongooseModule - MongoDB connection
 * - AuthModule - User authentication
 * - JobsGateway - WebSocket for real-time updates
 *
 * **Environment Variables Required**:
 * - MONGODB_URI - MongoDB connection string
 * - JWT_SECRET - Secret key for JWT tokens
 * - REDIS_HOST - Redis server host (optional)
 * - REDIS_PORT - Redis server port (optional)
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'exports'),
      serveRoot: '/downloads',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/harmonia',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    SongsModule,
    LibraryModule,
    ProfileModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, JobsGateway],
})
export class AppModule {}
