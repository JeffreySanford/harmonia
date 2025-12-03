# Redis Caching & Session Management

## Overview

Redis is integrated as a high-performance in-memory data store for session management and request/response caching. This significantly improves application performance by reducing database queries and speeding up authentication checks.

**Key Use Cases**:

- **Session Storage**: JWT tokens, user authentication state
- **Request/Response Caching**: API responses, computation results
- **Rate Limiting**: Track API request counts per user/IP
- **Temporary Data**: Generation job status, progress tracking
- **Pub/Sub**: Real-time notifications, WebSocket messaging

**Performance Benefits**:

- Sub-millisecond latency for cached data
- Reduced MongoDB load (80-90% query reduction for sessions)
- Faster authentication checks (no DB lookup on every request)
- Improved scalability (horizontal scaling with Redis Cluster)

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Angular)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HTTP Requests with JWT Token                                      │
│  ↓                                                                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  │ Bearer <access_token>
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                         Backend (NestJS)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────┐          │
│  │         HTTP Interceptor / Middleware                │          │
│  │  1. Extract JWT from Authorization header            │          │
│  │  2. Check Redis for session validity                 │          │
│  │  3. If cache miss → validate with JWT service        │          │
│  └──────────────┬───────────────────────────────────────┘          │
│                 │                                                   │
│         ┌───────┴────────┬──────────────┐                          │
│         │                │              │                          │
│  ┌──────▼──────┐  ┌─────▼───────┐  ┌──▼──────────┐                │
│  │   Redis     │  │  MongoDB    │  │  Business   │                │
│  │   Cache     │  │  Persistent │  │  Logic      │                │
│  │  (Fast)     │  │  Storage    │  │  Layer      │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
│  Cache Strategy:                                                   │
│  1. Check Redis first (cache-aside pattern)                        │
│  2. If miss → query MongoDB → store in Redis                       │
│  3. Set TTL based on data type                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Redis Data Store                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Key Namespaces:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  session:{userId}       → User session data (7 days TTL)    │   │
│  │  cache:user:{userId}    → User profile data (1 hour TTL)    │   │
│  │  cache:library:{userId} → Library items (30 min TTL)        │   │
│  │  cache:songs:{id}       → Song metadata (1 hour TTL)        │   │
│  │  job:{jobId}            → Generation job status (1 day TTL) │   │
│  │  rate:{userId}:{route}  → Rate limit counters (1 min TTL)   │   │
│  │  temp:{key}             → Temporary data (custom TTL)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Docker Configuration

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Redis Service
  redis:
    image: redis:7-alpine
    container_name: harmonia-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf  # Optional: custom config
    command: redis-server /usr/local/etc/redis/redis.conf --requirepass ${REDIS_PASSWORD}
    networks:
      - harmonia-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
    environment:
      - REDIS_REPLICATION_MODE=master

  # Backend Service (updated)
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: harmonia-backend
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT:-3333}:3333"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - harmonia-network
    volumes:
      - ./uploads:/app/uploads
      - ./models:/app/models

  # MongoDB Service
  mongodb:
    image: mongo:7
    container_name: harmonia-mongodb
    restart: unless-stopped
    ports:
      - "${MONGODB_PORT:-27017}:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
      - MONGO_INITDB_DATABASE=harmonia
    volumes:
      - mongodb-data:/data/db
      - mongodb-config:/data/configdb
    networks:
      - harmonia-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 20s

volumes:
  redis-data:
    driver: local
  mongodb-data:
    driver: local
  mongodb-config:
    driver: local

networks:
  harmonia-network:
    driver: bridge
```

### Custom Redis Configuration

```conf
# redis.conf (optional)

# Network
bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# General
daemonize no
supervised no
pidfile /var/run/redis_6379.pid
loglevel notice
logfile ""

# Persistence (RDB)
save 900 1       # Save if 1 key changed in 900 seconds
save 300 10      # Save if 10 keys changed in 300 seconds
save 60 10000    # Save if 10000 keys changed in 60 seconds
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data

# Append Only File (AOF) - more durable
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Memory Management
maxmemory 512mb
maxmemory-policy allkeys-lru  # Evict least recently used keys

# Lazy Freeing
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes

# Performance
slowlog-log-slower-than 10000
slowlog-max-len 128
```

### Environment Variables

```bash
# .env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-redis-password-here
REDIS_DB=0
REDIS_TTL_DEFAULT=3600  # 1 hour in seconds
```

## Backend Implementation

### Redis Module Setup

```typescript
// redis.module.ts
import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ConfigModule } from '@nestjs/config';

@Global()  // Make available across entire app
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

### Redis Service

```typescript
// redis.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {
    this.client = createClient({
      socket: {
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
      },
      password: this.configService.get('REDIS_PASSWORD'),
      database: this.configService.get('REDIS_DB', 0),
    });

    // Error handling
    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis Client Connected');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis Client Ready');
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ==================== Basic Operations ====================

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Get and parse JSON value
   */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Set value with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Set JSON value with optional TTL
   */
  async setJson<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  /**
   * Delete key(s)
   */
  async del(...keys: string[]): Promise<number> {
    return this.client.del(keys);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Set expiration on existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    return this.client.expire(key, seconds);
  }

  /**
   * Get time-to-live for key
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // ==================== Pattern Operations ====================

  /**
   * Get all keys matching pattern
   * WARNING: Use with caution in production (blocking operation)
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /**
   * Delete all keys matching pattern
   */
  async delPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    if (keys.length === 0) return 0;
    return this.del(...keys);
  }

  // ==================== Hash Operations ====================

  /**
   * Set hash field
   */
  async hSet(key: string, field: string, value: string): Promise<number> {
    return this.client.hSet(key, field, value);
  }

  /**
   * Get hash field
   */
  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.client.hGet(key, field);
  }

  /**
   * Get all hash fields and values
   */
  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.client.hGetAll(key);
  }

  /**
   * Delete hash field
   */
  async hDel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hDel(key, fields);
  }

  // ==================== List Operations ====================

  /**
   * Push to left of list
   */
  async lPush(key: string, ...values: string[]): Promise<number> {
    return this.client.lPush(key, values);
  }

  /**
   * Push to right of list
   */
  async rPush(key: string, ...values: string[]): Promise<number> {
    return this.client.rPush(key, values);
  }

  /**
   * Get list range
   */
  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lRange(key, start, stop);
  }

  /**
   * Get list length
   */
  async lLen(key: string): Promise<number> {
    return this.client.lLen(key);
  }

  // ==================== Set Operations ====================

  /**
   * Add to set
   */
  async sAdd(key: string, ...members: string[]): Promise<number> {
    return this.client.sAdd(key, members);
  }

  /**
   * Get all set members
   */
  async sMembers(key: string): Promise<string[]> {
    return this.client.sMembers(key);
  }

  /**
   * Check if member exists in set
   */
  async sIsMember(key: string, member: string): Promise<boolean> {
    return this.client.sIsMember(key, member);
  }

  /**
   * Remove from set
   */
  async sRem(key: string, ...members: string[]): Promise<number> {
    return this.client.sRem(key, members);
  }

  // ==================== Counter Operations ====================

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Increment counter by amount
   */
  async incrBy(key: string, amount: number): Promise<number> {
    return this.client.incrBy(key, amount);
  }

  /**
   * Decrement counter
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  /**
   * Decrement counter by amount
   */
  async decrBy(key: string, amount: number): Promise<number> {
    return this.client.decrBy(key, amount);
  }

  // ==================== Pub/Sub Operations ====================

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, callback);
  }

  // ==================== Cache Helper Methods ====================

  /**
   * Cache-aside pattern: get from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.getJson<T>(key);
    if (cached !== null) {
      this.logger.debug(`Cache hit: ${key}`);
      return cached;
    }

    // Cache miss - fetch data
    this.logger.debug(`Cache miss: ${key}`);
    const data = await fetcher();

    // Store in cache
    await this.setJson(key, data, ttl);

    return data;
  }

  /**
   * Invalidate cache for specific pattern
   */
  async invalidate(pattern: string): Promise<number> {
    return this.delPattern(pattern);
  }

  /**
   * Invalidate multiple patterns
   */
  async invalidateMultiple(patterns: string[]): Promise<number> {
    let total = 0;
    for (const pattern of patterns) {
      total += await this.invalidate(pattern);
    }
    return total;
  }
}
```

## Caching Strategies

### 1. Session Caching

```typescript
// auth.service.ts (excerpt)
export class AuthService {
  constructor(
    private redisService: RedisService,
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

  async storeSession(userId: string, accessToken: string, refreshToken: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    const sessionData = {
      userId,
      accessToken: accessToken.substring(0, 30), // Store token prefix for validation
      refreshToken,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    // Store session with 7-day TTL (matches refresh token expiry)
    await this.redisService.setJson(sessionKey, sessionData, 7 * 24 * 60 * 60);
  }

  async validateSession(userId: string, accessTokenPrefix: string): Promise<boolean> {
    const sessionKey = `session:${userId}`;
    const session = await this.redisService.getJson<any>(sessionKey);

    if (!session) {
      return false;
    }

    // Verify token prefix matches
    return session.accessToken === accessTokenPrefix;
  }

  async updateSessionActivity(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    const session = await this.redisService.getJson<any>(sessionKey);

    if (session) {
      session.lastActivity = Date.now();
      await this.redisService.setJson(sessionKey, session, 7 * 24 * 60 * 60);
    }
  }

  async destroySession(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    await this.redisService.del(sessionKey);
  }
}
```

### 2. User Profile Caching

```typescript
// users.service.ts (excerpt)
export class UsersService {
  constructor(
    private redisService: RedisService,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

  async getUserById(userId: string): Promise<User> {
    const cacheKey = `cache:user:${userId}`;
    const ttl = 60 * 60;  // 1 hour

    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const user = await this.userModel.findById(userId);
        if (!user) {
          throw new NotFoundException('User not found');
        }
        return this.mapToDto(user);
      },
      ttl
    );
  }

  async updateUser(userId: string, updates: any): Promise<User> {
    // Update database
    const user = await this.userModel.findByIdAndUpdate(userId, updates, { new: true });

    // Invalidate cache
    await this.redisService.del(`cache:user:${userId}`);

    return this.mapToDto(user);
  }
}
```

### 3. Library Items Caching

```typescript
// library.service.ts (excerpt)
export class LibraryService {
  constructor(
    private redisService: RedisService,
    @InjectModel(LibraryItem.name) private libraryItemModel: Model<LibraryItemDocument>
  ) {}

  async findByUserId(userId: string, filters: any, page: number) {
    // Generate cache key based on filters and pagination
    const cacheKey = `cache:library:${userId}:${JSON.stringify(filters)}:${page}`;
    const ttl = 30 * 60;  // 30 minutes

    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const pageSize = 20;
        const skip = (page - 1) * pageSize;

        // Build query...
        const query: any = { userId };
        if (filters.type && filters.type !== 'all') {
          query.type = filters.type;
        }

        // Execute query...
        const [items, total] = await Promise.all([
          this.libraryItemModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
          this.libraryItemModel.countDocuments(query)
        ]);

        return {
          items: items.map(item => this.mapToDto(item)),
          total,
          page,
          pageSize
        };
      },
      ttl
    );
  }

  async createLibraryItem(data: any): Promise<LibraryItem> {
    const item = await this.libraryItemModel.create(data);

    // Invalidate user's library cache
    await this.redisService.invalidate(`cache:library:${data.userId}:*`);

    return this.mapToDto(item);
  }

  async deleteLibraryItem(id: string, userId: string): Promise<void> {
    await this.libraryItemModel.findByIdAndDelete(id);

    // Invalidate cache
    await this.redisService.invalidateMultiple([
      `cache:library:${userId}:*`,
      `cache:songs:${id}`
    ]);
  }
}
```

### 4. Rate Limiting

```typescript
// rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;  // Skip rate limiting for unauthenticated requests
    }

    const route = request.route.path;
    const userId = user.sub;

    // Rate limit: 100 requests per minute per user per route
    const key = `rate:${userId}:${route}`;
    const limit = 100;
    const window = 60;  // seconds

    const current = await this.redisService.incr(key);

    if (current === 1) {
      // First request - set TTL
      await this.redisService.expire(key, window);
    }

    if (current > limit) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }
}

// Usage in controller:
// @UseGuards(JwtAuthGuard, RateLimitGuard)
// @Post('generate')
// async generate() { ... }
```

### 5. Generation Job Status

```typescript
// jobs.service.ts (excerpt)
export class JobsService {
  constructor(private redisService: RedisService) {}

  async createJob(userId: string, type: string, params: any): Promise<string> {
    const jobId = uuidv4();
    const jobKey = `job:${jobId}`;

    const jobData = {
      id: jobId,
      userId,
      type,
      params,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Store job with 24-hour TTL
    await this.redisService.setJson(jobKey, jobData, 24 * 60 * 60);

    return jobId;
  }

  async updateJobProgress(jobId: string, progress: number, status: string): Promise<void> {
    const jobKey = `job:${jobId}`;
    const job = await this.redisService.getJson<any>(jobKey);

    if (job) {
      job.progress = progress;
      job.status = status;
      job.updatedAt = Date.now();
      await this.redisService.setJson(jobKey, job, 24 * 60 * 60);

      // Publish progress update for WebSocket
      await this.redisService.publish(`job:${jobId}:progress`, JSON.stringify({ progress, status }));
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    const jobKey = `job:${jobId}`;
    return this.redisService.getJson(jobKey);
  }

  async completeJob(jobId: string, result: any): Promise<void> {
    const jobKey = `job:${jobId}`;
    const job = await this.redisService.getJson<any>(jobKey);

    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.completedAt = Date.now();
      await this.redisService.setJson(jobKey, job, 24 * 60 * 60);

      // Publish completion event
      await this.redisService.publish(`job:${jobId}:completed`, JSON.stringify(result));
    }
  }
}
```

## Cache Invalidation Strategies

### 1. Time-Based Invalidation (TTL)

```typescript
// Automatic expiration
await this.redisService.setJson(key, data, 3600);  // Expires in 1 hour
```

### 2. Event-Based Invalidation

```typescript
// On user update, invalidate related caches
async updateUser(userId: string, updates: any) {
  await this.userModel.findByIdAndUpdate(userId, updates);
  
  // Invalidate all user-related caches
  await this.redisService.invalidateMultiple([
    `cache:user:${userId}`,
    `cache:library:${userId}:*`,
    `session:${userId}`
  ]);
}
```

### 3. Pattern-Based Invalidation

```typescript
// Invalidate all library caches for a user
await this.redisService.invalidate(`cache:library:${userId}:*`);

// Invalidate all song caches
await this.redisService.invalidate(`cache:songs:*`);
```

### 4. Write-Through Caching

```typescript
// Update cache immediately after database write
async updateUser(userId: string, updates: any) {
  const user = await this.userModel.findByIdAndUpdate(userId, updates, { new: true });
  
  // Update cache
  const cacheKey = `cache:user:${userId}`;
  await this.redisService.setJson(cacheKey, this.mapToDto(user), 3600);
  
  return user;
}
```

## Monitoring & Debugging

### Redis CLI Commands

```bash
# Connect to Redis container
docker exec -it harmonia-redis redis-cli -a your-password

# Monitor all commands in real-time
MONITOR

# Get all keys (WARNING: blocking in production)
KEYS *

# Get keys matching pattern
KEYS cache:user:*

# Get key value
GET session:507f1f77bcf86cd799439011

# Get key TTL
TTL session:507f1f77bcf86cd799439011

# Get database info
INFO

# Get memory usage
INFO memory

# Get keyspace statistics
INFO keyspace

# Flush all data (WARNING: deletes everything)
FLUSHALL

# Flush current database only
FLUSHDB
```

### Performance Metrics Service

```typescript
// redis-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisMetricsService {
  constructor(private redisService: RedisService) {}

  async getCacheMetrics() {
    // Get all cache keys
    const cacheKeys = await this.redisService.keys('cache:*');
    const sessionKeys = await this.redisService.keys('session:*');
    const jobKeys = await this.redisService.keys('job:*');

    // Calculate total memory usage (approximate)
    let totalSize = 0;
    for (const key of cacheKeys) {
      const value = await this.redisService.get(key);
      if (value) {
        totalSize += Buffer.byteLength(value, 'utf8');
      }
    }

    return {
      totalKeys: cacheKeys.length + sessionKeys.length + jobKeys.length,
      cacheKeys: cacheKeys.length,
      sessionKeys: sessionKeys.length,
      jobKeys: jobKeys.length,
      totalMemoryUsage: totalSize,
      memoryUsageFormatted: this.formatBytes(totalSize)
    };
  }

  async getCacheHitRate() {
    // Implement cache hit/miss tracking
    const hits = await this.redisService.get('metrics:cache:hits');
    const misses = await this.redisService.get('metrics:cache:misses');

    const hitsNum = hits ? parseInt(hits) : 0;
    const missesNum = misses ? parseInt(misses) : 0;
    const total = hitsNum + missesNum;

    return {
      hits: hitsNum,
      misses: missesNum,
      total,
      hitRate: total > 0 ? ((hitsNum / total) * 100).toFixed(2) + '%' : '0%'
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}
```

## Best Practices

### 1. Key Naming Conventions

```typescript
// Use hierarchical namespaces with colons
session:{userId}
cache:user:{userId}
cache:library:{userId}:{filter}:{page}
job:{jobId}
rate:{userId}:{route}
temp:{uniqueKey}

// Avoid special characters in keys
// Good: cache:user:507f1f77bcf86cd799439011
// Bad: cache/user/507f1f77bcf86cd799439011
```

### 2. TTL Guidelines

```typescript
// Session data: Match JWT expiry (7 days)
await this.redisService.setJson(sessionKey, sessionData, 7 * 24 * 60 * 60);

// User profiles: 1 hour (frequently accessed, rarely changed)
await this.redisService.setJson(userKey, userData, 60 * 60);

// Library items: 30 minutes (moderately dynamic)
await this.redisService.setJson(libraryKey, libraryData, 30 * 60);

// Generation jobs: 24 hours (temporary, auto-cleanup)
await this.redisService.setJson(jobKey, jobData, 24 * 60 * 60);

// Rate limiting: 1 minute (sliding window)
await this.redisService.setEx(rateKey, 60, '0');

// Temporary data: Custom (e.g., 5 minutes for email verification codes)
await this.redisService.setJson(tempKey, tempData, 5 * 60);
```

### 3. Error Handling

```typescript
// Always handle Redis errors gracefully
async getUserFromCache(userId: string): Promise<User | null> {
  try {
    const cached = await this.redisService.getJson<User>(`cache:user:${userId}`);
    return cached;
  } catch (error) {
    this.logger.error(`Redis error: ${error.message}`);
    // Fallback to database query
    return this.getUserFromDatabase(userId);
  }
}
```

### 4. Avoid Cache Stampede

```typescript
// Use mutex/lock to prevent multiple requests from fetching same data
async getWithLock<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  const lockKey = `lock:${key}`;
  const lockTTL = 10;  // Lock expires after 10 seconds

  // Try to acquire lock
  const acquired = await this.redisService.set(lockKey, '1', lockTTL);

  if (!acquired) {
    // Lock already held, wait and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.getWithLock(key, fetcher, ttl);
  }

  try {
    // Check cache again (another request might have populated it)
    const cached = await this.redisService.getJson<T>(key);
    if (cached) return cached;

    // Fetch and cache
    const data = await fetcher();
    await this.redisService.setJson(key, data, ttl);
    return data;
  } finally {
    // Release lock
    await this.redisService.del(lockKey);
  }
}
```

### 5. Connection Pooling

Redis client already handles connection pooling internally. No additional configuration needed for single-instance Redis.

For Redis Cluster, use:

```typescript
// redis.service.ts (cluster mode)
this.client = createCluster({
  rootNodes: [
    { url: 'redis://redis-1:6379' },
    { url: 'redis://redis-2:6379' },
    { url: 'redis://redis-3:6379' }
  ],
  defaults: {
    password: this.configService.get('REDIS_PASSWORD')
  }
});
```

## Testing Strategy

### Unit Tests

```typescript
describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      setEx: jest.fn()
    };

    service = new RedisService(mockRedisClient);
  });

  it('should get and parse JSON', async () => {
    const data = { id: '123', name: 'Test' };
    mockRedisClient.get.mockResolvedValue(JSON.stringify(data));

    const result = await service.getJson('test-key');
    expect(result).toEqual(data);
  });

  it('should handle cache miss gracefully', async () => {
    mockRedisClient.get.mockResolvedValue(null);

    const result = await service.getJson('nonexistent-key');
    expect(result).toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('Auth Service with Redis', () => {
  it('should store and retrieve session', async () => {
    const userId = 'test-user-123';
    const accessToken = 'test-token';
    const refreshToken = 'test-refresh';

    await authService.storeSession(userId, accessToken, refreshToken);

    const session = await redisService.getJson(`session:${userId}`);
    expect(session).toHaveProperty('userId', userId);
    expect(session).toHaveProperty('accessToken');
  });

  it('should invalidate session on logout', async () => {
    const userId = 'test-user-123';
    await authService.storeSession(userId, 'token', 'refresh');

    await authService.destroySession(userId);

    const session = await redisService.getJson(`session:${userId}`);
    expect(session).toBeNull();
  });
});
```

## Troubleshooting

### Common Issues

**Issue**: "ECONNREFUSED: Connection refused"

- **Cause**: Redis container not running
- **Solution**: `docker-compose up redis -d`

**Issue**: "NOAUTH Authentication required"

- **Cause**: Password not provided or incorrect
- **Solution**: Check `REDIS_PASSWORD` in `.env`

**Issue**: "OOM command not allowed when used memory > 'maxmemory'"

- **Cause**: Redis memory limit reached
- **Solution**: Increase `maxmemory` in `redis.conf` or enable LRU eviction

**Issue**: Keys not expiring

- **Cause**: TTL not set or system clock issues
- **Solution**: Verify TTL with `TTL key-name`, check system time

**Issue**: Slow performance

- **Cause**: Large keys, blocking commands (KEYS *), high memory usage
- **Solution**: Use SCAN instead of KEYS, optimize key sizes, monitor with `INFO`

## Production Checklist

- [ ] Set strong `REDIS_PASSWORD` (minimum 32 characters)
- [ ] Enable Redis persistence (RDB + AOF)
- [ ] Set `maxmemory` and `maxmemory-policy`
- [ ] Configure backup strategy (RDB snapshots to S3)
- [ ] Enable Redis authentication (`requirepass`)
- [ ] Use TLS for Redis connections (in cloud deployments)
- [ ] Monitor memory usage and hit rates
- [ ] Set up alerts for high memory usage
- [ ] Implement graceful degradation (fallback to DB on Redis failure)
- [ ] Document cache invalidation strategies
- [ ] Load test cache performance
- [ ] Set up Redis Sentinel or Cluster for high availability (production)

---

**Document Version**: 1.0.0  
**Last Updated**: December 2, 2025  
**Status**: Design Complete - Implementation Ready  
**Priority**: HIGH - Performance Critical

**LEGENDARY IS OUR STANDARD!** ⚡
