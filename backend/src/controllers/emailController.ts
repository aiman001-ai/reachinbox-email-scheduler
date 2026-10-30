import { Request, Response } from 'express';
import { EmailService } from '../services/emailService';
import { SearchService } from '../services/searchService';
import { RateLimitService } from '../services/rateLimitService';
import { config } from '../config/env';
import { emailQueue } from '../queues/emailQueue';
import { redisConnection } from '../config/redis';
import { prisma } from '../config/db';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export class EmailController {
  public static async schedule(req: Request, res: Response): Promise<void> {
    try {
      const {
        sender,
        recipients,
        subject,
        body,
        startTime,
        delayBetweenSeconds,
        hourlyLimit,
        userId,
      } = req.body;

      if (!sender || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ error: 'Valid sender and at least one recipient are required' });
        return;
      }

      if (!subject || !body) {
        res.status(400).json({ error: 'Email subject and body are required' });
        return;
      }

      const cleanRecipients = recipients
        .map((r: string) => r.trim())
        .filter((r: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));

      if (cleanRecipients.length === 0) {
        res.status(400).json({ error: 'No valid recipient email addresses found' });
        return;
      }

      const result = await EmailService.scheduleBatch({
        userId,
        sender,
        recipients: cleanRecipients,
        subject,
        body,
        startTime,
        delayBetweenSeconds: delayBetweenSeconds ? Number(delayBetweenSeconds) : config.worker.minDelaySeconds,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : config.worker.defaultHourlyLimit,
      });

      res.status(201).json({
        success: true,
        message: `Successfully scheduled ${result.scheduledCount} email(s)`,
        data: result,
      });
    } catch (error) {
      console.error('[EmailController.schedule] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async uploadLeads(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No CSV or text file uploaded' });
        return;
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const matches = fileContent.match(EMAIL_REGEX) || [];
      const uniqueEmails = Array.from(new Set(matches.map((e) => e.toLowerCase())));

      res.json({
        success: true,
        totalFound: uniqueEmails.length,
        emails: uniqueEmails,
        fileName: req.file.originalname,
      });
    } catch (error) {
      console.error('[EmailController.uploadLeads] Error:', error);
      res.status(500).json({ error: 'Failed to parse leads file' });
    }
  }

  public static async getScheduled(req: Request, res: Response): Promise<void> {
    try {
      const { search, page, limit, userId } = req.query;

      const result = await EmailService.getScheduledEmails({
        userId: userId as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.json(result);
    } catch (error) {
      console.error('[EmailController.getScheduled] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async getSent(req: Request, res: Response): Promise<void> {
    try {
      const { search, page, limit, userId } = req.query;

      const result = await EmailService.getSentEmails({
        userId: userId as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.json(result);
    } catch (error) {
      console.error('[EmailController.getSent] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async search(req: Request, res: Response): Promise<void> {
    try {
      const { q, status, userId } = req.query;

      const results = await SearchService.searchEmails((q as string) || '', {
        status: status as string | undefined,
        userId: userId as string | undefined,
      });

      res.json(results);
    } catch (error) {
      console.error('[EmailController.search] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [scheduledCount, sentCount, failedCount] = await Promise.all([
        prisma.emailJob.count({ where: { status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMIT'] } } }),
        prisma.emailJob.count({ where: { status: 'SENT' } }),
        prisma.emailJob.count({ where: { status: 'FAILED' } }),
      ]);

      let queueCounts = {
        delayed: scheduledCount,
        waiting: 0,
        active: 0,
        completed: sentCount,
        failed: failedCount,
      };

      if (redisConnection.status === 'ready') {
        try {
          const counts = await Promise.race([
            emailQueue.getJobCounts('delayed', 'waiting', 'active', 'completed', 'failed'),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 200)),
          ]);
          if (counts) {
            queueCounts = counts;
          }
        } catch {
          // Redis offline or slow, fallback to DB counts
        }
      }

      res.json({
        database: {
          scheduled: scheduledCount,
          sent: sentCount,
          failed: failedCount,
        },
        queue: queueCounts,
        concurrency: config.worker.concurrency,
        minDelaySeconds: config.worker.minDelaySeconds,
      });
    } catch (error) {
      console.error('[EmailController.getStats] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
