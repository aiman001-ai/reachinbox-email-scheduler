import Redis, { RedisOptions } from 'ioredis';
import { config } from './env';

const redisOptions: RedisOptions = config.redis.url
  ? {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }
  : {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    };

export const redisConnection = config.redis.url
  ? new Redis(config.redis.url, redisOptions)
  : new Redis(redisOptions);

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});
