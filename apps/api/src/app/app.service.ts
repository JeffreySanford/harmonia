import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class AppService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({ host: 'localhost', port: 6379 });
  }

  async getData(): Promise<{ message: string }> {
    await this.redis.set('api_status', 'online');
    return { message: 'Hello API' };
  }

  async getMusic(): Promise<{ message: string }> {
    await this.redis.set('music_status', 'requested');
    return { message: 'Music Generation Service endpoint' };
  }

  async getVideo(): Promise<{ message: string }> {
    await this.redis.set('video_status', 'requested');
    return { message: 'Video Generation Service endpoint' };
  }

  async getVocal(): Promise<{ message: string }> {
    await this.redis.set('vocal_status', 'requested');
    return { message: 'Vocal Styles Service endpoint' };
  }
}
