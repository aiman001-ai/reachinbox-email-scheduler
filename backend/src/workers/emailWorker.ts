import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { config } from '../config/env';
import { prisma } from '../config/db';
import { EMAIL_QUEUE_NAME, emailQueue, EmailJobData } from '../queues/emailQueue';
import { SmtpService } from '../services/smtpService';
import { RateLimitService } from '../services/rateLimitService';
import { SearchService } from '../services/searchService';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createEmailWorker = () => {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { jobRecordId, userId, sender, recipient, subject, body, delayBetweenSeconds, hourlyLimit } =
        job.data;

      const record = await prisma.emailJob.findUnique({
        where: { id: jobRecordId },
      });

      if (!record) {
        console.warn(`[Worker] Job record ${jobRecordId} not found in database. Skipping.`);
        return { skipped: true, reason: 'Record not found' };
      }

      if (record.status === 'SENT') {
        console.log(`[Worker] Email ${jobRecordId} was already sent. Skipping for idempotency.`);
        return { skipped: true, reason: 'Already sent' };
      }

      const rateLimitResult = await RateLimitService.checkAndConsume(sender, hourlyLimit, userId);

      if (!rateLimitResult.allowed) {
        console.warn(
          `[Worker] Rate limit reached for sender "${sender}" (${rateLimitResult.currentCount}/${hourlyLimit}). Rescheduling job ${jobRecordId} to ${rateLimitResult.nextWindowStart.toISOString()}`
        );

        await prisma.emailJob.update({
          where: { id: jobRecordId },
          data: {
            status: 'DELAYED_RATE_LIMIT',
            scheduledAt: rateLimitResult.nextWindowStart,
          },
        });

        await emailQueue.add('send-email', job.data, {
          delay: rateLimitResult.retryAfterMs,
          jobId: `${jobRecordId}-retry-${rateLimitResult.nextWindowStart.getTime()}`,
        });

        return {
          rateLimited: true,
          rescheduledAt: rateLimitResult.nextWindowStart,
        };
      }

      await prisma.emailJob.update({
        where: { id: jobRecordId },
        data: { status: 'PROCESSING' },
      });

      try {
        const sendResult = await SmtpService.sendMail({
          sender,
          recipient,
          subject,
          body,
        });

        const updated = await prisma.emailJob.update({
          where: { id: jobRecordId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealMessageId: sendResult.messageId,
            etherealPreviewUrl: sendResult.previewUrl || null,
          },
        });

        await SearchService.indexEmail(updated).catch(() => {});

        console.log(`[Worker] Sent email to ${recipient}. Preview URL: ${sendResult.previewUrl || 'N/A'}`);

        const throttleMs = Math.max(1000, (delayBetweenSeconds || config.worker.minDelaySeconds) * 1000);
        await sleep(throttleMs);

        return {
          success: true,
          messageId: sendResult.messageId,
          previewUrl: sendResult.previewUrl,
        };
      } catch (sendError) {
        console.error(`[Worker] Failed to dispatch email ${jobRecordId}:`, (sendError as Error).message);

        if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
          await prisma.emailJob.update({
            where: { id: jobRecordId },
            data: {
              status: 'FAILED',
              errorReason: (sendError as Error).message,
            },
          });
        }

        throw sendError;
      }
    },
    {
      connection: redisConnection,
      concurrency: config.worker.concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
};
