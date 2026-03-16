import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      ...(redisPassword &&
        redisPassword.trim() !== '' && { password: redisPassword }),
      db: this.configService.get<number>('REDIS_DB') || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      console.log('Redis connection established');
    } catch (err) {
      console.warn('Redis connection failed on startup:', err.message ?? err);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Get Redis client instance
  getClient(): Redis {
    return this.client;
  }

  // Set key-value pair
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  // Get value by key
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  // Delete key
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // Set expiration on key
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  // Get TTL of key
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  // Set hash field
  async hset(key: string, field: string, value: string): Promise<number> {
    return await this.client.hset(key, field, value);
  }

  // Get hash field
  async hget(key: string, field: string): Promise<string | null> {
    return await this.client.hget(key, field);
  }

  // Get all hash fields
  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.client.hgetall(key);
  }

  // Delete hash field
  async hdel(key: string, field: string): Promise<number> {
    return await this.client.hdel(key, field);
  }

  // Increment value
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  // Decrement value
  async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }
}
