import { redisConnection } from '../config/redis';
import { SlackService } from './slackService';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  nextWindowStart: Date;
  retryAfterMs: number;
}

export class RateLimitService {
  private static getHourWindowKey(sender: string, date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `ratelimit:${sender}:${year}-${month}-${day}-${hour}`;
  }

  public static getNextHourWindowStart(now: Date = new Date()): Date {
    const nextHour = new Date(now);
    nextHour.setUTCMinutes(0, 0, 0);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    return nextHour;
  }

  public static async checkAndConsume(
    sender: string,
    hourlyLimit: number,
    userId?: string
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const key = this.getHourWindowKey(sender, now);
    const nextWindowStart = this.getNextHourWindowStart(now);
    const retryAfterMs = Math.max(1000, nextWindowStart.getTime() - now.getTime());

    const currentCountStr = await redisConnection.get(key);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;

    if (currentCount >= hourlyLimit) {
      await this.handleRateLimitHit(sender, hourlyLimit, nextWindowStart, userId);

      return {
        allowed: false,
        currentCount,
        limit: hourlyLimit,
        nextWindowStart,
        retryAfterMs,
      };
    }

    const multi = redisConnection.multi();
    multi.incr(key);
    multi.expire(key, 7200);
    const results = await multi.exec();

    const newCount = (results?.[0]?.[1] as number) || currentCount + 1;

    return {
      allowed: true,
      currentCount: newCount,
      limit: hourlyLimit,
      nextWindowStart,
      retryAfterMs,
    };
  }

  private static async handleRateLimitHit(
    sender: string,
    hourlyLimit: number,
    nextWindowStart: Date,
    userId?: string
  ): Promise<void> {
    const now = new Date();
    const alertKey = `alert_sent:${sender}:${this.getHourWindowKey(sender, now)}`;

    const alreadyAlerted = await redisConnection.get(alertKey);
    if (!alreadyAlerted) {
      await redisConnection.set(alertKey, 'true', 'EX', 7200);

      await SlackService.notifyRateLimitHit({
        sender,
        hourlyLimit,
        userId,
        rescheduledTime: nextWindowStart,
      });
    }
  }

  public static async getSenderHourlyUsage(sender: string): Promise<number> {
    const key = this.getHourWindowKey(sender);
    const val = await redisConnection.get(key);
    return val ? parseInt(val, 10) : 0;
  }
}
