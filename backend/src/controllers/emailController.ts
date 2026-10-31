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

  public static async previewEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const job = await prisma.emailJob.findUnique({
        where: { id },
      });

      if (!job) {
        res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Email Not Found</title></head>
            <body style="font-family: system-ui, sans-serif; background: #0b0f17; color: #fff; padding: 40px; text-align: center;">
              <h2>Email record not found</h2>
              <p style="color: #94a3b8;">Job ID: ${id}</p>
            </body>
          </html>
        `);
        return;
      }

      const escapeHtml = (text: string) =>
        text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

      const formattedDate = job.sentAt
        ? new Date(job.sentAt).toLocaleString()
        : new Date(job.scheduledAt).toLocaleString();

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>ReachInbox Email Preview - ${escapeHtml(job.subject)}</title>
            <style>
              body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b0f17; color: #e2e8f0; }
              .container { max-width: 680px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
              .header { background: #1e293b; padding: 18px 24px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
              .brand { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #818cf8; }
              .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: ${job.status === 'SENT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)'}; color: ${job.status === 'SENT' ? '#34d399' : '#818cf8'}; border: 1px solid ${job.status === 'SENT' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}; }
              .meta { padding: 20px 24px; background: #0f172a; border-bottom: 1px solid #1e293b; font-size: 13px; line-height: 1.8; color: #94a3b8; }
              .meta strong { color: #f1f5f9; display: inline-block; width: 80px; }
              .body { padding: 32px 24px; font-size: 15px; line-height: 1.7; background: #ffffff; color: #1e293b; min-height: 200px; }
              .footer { padding: 16px 24px; background: #0f172a; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="brand">
                  <span>ReachInbox Email Preview</span>
                </div>
                <span class="badge">${job.status}</span>
              </div>
              <div class="meta">
                <div><strong>Subject:</strong> <span style="color: #f8fafc; font-weight: 600;">${escapeHtml(job.subject)}</span></div>
                <div><strong>From:</strong> &lt;${escapeHtml(job.sender)}&gt;</div>
                <div><strong>To:</strong> &lt;${escapeHtml(job.recipient)}&gt;</div>
                <div><strong>Date:</strong> ${formattedDate}</div>
                <div><strong>Job ID:</strong> <span style="font-family: monospace; font-size: 11px;">${job.id}</span></div>
              </div>
              <div class="body">
                ${escapeHtml(job.body).replace(/\n/g, '<br/>')}
              </div>
              <div class="footer">
                Delivered via ReachInbox Automated Job Scheduler &bull; Simulated ESP Dispatch
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send('Error rendering preview: ' + (error as Error).message);
    }
  }
}
