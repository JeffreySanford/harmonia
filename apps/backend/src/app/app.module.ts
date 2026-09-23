import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JobsModule } from '../jobs/jobs.module';
import { HealthController } from '../health/health.controller';
import { AuthModule } from '../auth/auth.module';
import { SongsModule } from '../songs/songs.module';
import { LibraryModule } from '../library/library.module';
import { ProfileModule } from '../profile/profile.module';
import { MusicRuntimeModule } from '../music-runtime/music-runtime.module';

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
 * - MONGO_HARMONIA_PASSWORD - Application database password
 * - MONGODB_URI - Optional explicit MongoDB connection string override
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
      useFactory: async (configService: ConfigService) => {
        const explicitUri = configService.get<string>('MONGODB_URI')?.trim();
        if (explicitUri) {
          return { uri: explicitUri };
        }

        const appPassword = configService
          .get<string>('MONGO_HARMONIA_PASSWORD')
          ?.trim();

        if (!appPassword) {
          throw new Error(
            'MONGO_HARMONIA_PASSWORD is required when MONGODB_URI is not set.'
          );
        }

        return {
          uri:
            `mongodb://harmonia_app:${encodeURIComponent(appPassword)}` +
            '@127.0.0.1:27017/harmonia?authSource=harmonia',
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    SongsModule,
    LibraryModule,
    ProfileModule,
    MusicRuntimeModule,
    JobsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
