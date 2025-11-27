import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Subject } from 'rxjs';

export type ServiceStatus = { service: 'music' | 'video' | 'vocal'; status: string };

@Injectable()
export class AppService {
  private redis: Redis;
  private redisSubscriber: Redis;

  public status$ = new Subject<ServiceStatus>();
  private lastStatuses: Record<string, string> = {};

  constructor() {
    this.redis = new Redis({ host: 'localhost', port: 6379 });
    this.redisSubscriber = new Redis({ host: 'localhost', port: 6379 });
    // Subscribe to Redis 'status_updates' channel for PUB/SUB style updates
    this.redisSubscriber.subscribe('status_updates', (err, count) => {
      if (!err) {
        this.redisSubscriber.on('message', (channel, message) => {
          try {
            const parsed = JSON.parse(message);
            if (parsed && parsed.service && parsed.status) {
              this.status$.next({ service: parsed.service, status: parsed.status });
            }
          } catch (e) {
            // not JSON, ignore
          }
        });
      }
    });
  }

  // Removed polling check in favor of Redis PUB/SUB

  async getData(): Promise<{ message: string }> {
    await this.redis.set('api_status', 'online');
    return { message: 'Hello API' };
  }

  async getMusic(lyrics?: string): Promise<{ message: string }> {
    await this.redis.set('music_status', 'requested');
    // publish a status update and a separate request payload with optional lyrics
    await this.redis.publish('status_updates', JSON.stringify({ service: 'music', status: 'requested' }));
    await this.redis.publish('music_request', JSON.stringify({ service: 'music', lyrics: lyrics || '' }));
    return { message: 'Music Generation Service endpoint' };
  }

  async getVideo(): Promise<{ message: string }> {
    await this.redis.set('video_status', 'requested');
    await this.redis.publish('status_updates', JSON.stringify({ service: 'video', status: 'requested' }));
    return { message: 'Video Generation Service endpoint' };
  }

  async getVocal(): Promise<{ message: string }> {
    await this.redis.set('vocal_status', 'requested');
    await this.redis.publish('status_updates', JSON.stringify({ service: 'vocal', status: 'requested' }));
    return { message: 'Vocal Styles Service endpoint' };
  }

  async getMusicStatus(): Promise<{ status: string }> {
    const value = await this.redis.get('music_status');
    return { status: value || 'unknown' };
  }

  async getVideoStatus(): Promise<{ status: string }> {
    const value = await this.redis.get('video_status');
    return { status: value || 'unknown' };
  }

  async getVocalStatus(): Promise<{ status: string }> {
    const value = await this.redis.get('vocal_status');
    return { status: value || 'unknown' };
  }
}
