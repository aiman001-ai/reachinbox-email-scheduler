import crypto from 'crypto';
import { prisma } from '../config/db';
import { emailQueue, EmailJobData } from '../queues/emailQueue';
import { redisConnection } from '../config/redis';
import { SearchService } from './searchService';
import { SmtpService } from './smtpService';

export interface ScheduleEmailInput {
  userId?: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string | Date;
  delayBetweenSeconds?: number;
  hourlyLimit?: number;
}

export class EmailService {
  public static async scheduleBatch(input: ScheduleEmailInput) {
    const {
      userId,
      sender,
      recipients,
      subject,
      body,
      startTime = new Date(),
      delayBetweenSeconds = 2,
      hourlyLimit = 200,
    } = input;

    const baseStart = new Date(startTime).getTime();
    const now = Date.now();
    const effectiveStart = isNaN(baseStart) || baseStart < now ? now : baseStart;

    let validUserId: string | null = null;
    if (userId) {
      const userById = await prisma.user.findUnique({ where: { id: userId } });
      if (userById) {
        validUserId = userById.id;
      }
    }
    if (!validUserId && sender) {
      try {
        const userBySender = await prisma.user.upsert({
          where: { email: sender },
          update: {},
          create: {
            email: sender,
            name: sender.split('@')[0],
          },
        });
        validUserId = userBySender.id;
      } catch (err) {
        validUserId = null;
      }
    }

    const createdRecords: any[] = [];
    const jobsToInsert: any[] = [];

    for (let index = 0; index < recipients.length; index++) {
      const recipient = recipients[index].trim();
      if (!recipient) continue;

      const scheduledTimestamp = effectiveStart + index * delayBetweenSeconds * 1000;
      const scheduledAt = new Date(scheduledTimestamp);
      const id = crypto.randomUUID();

      const record = {
        id,
        userId: validUserId,
        sender,
        recipient,
        subject,
        body,
        status: 'SCHEDULED',
        scheduledAt,
        delayBetweenSeconds,
        hourlyLimit,
      };

      jobsToInsert.push(record);
      createdRecords.push(record);
    }

    if (jobsToInsert.length === 0) {
      return {
        scheduledCount: 0,
        jobs: [],
      };
    }

    // 1. Single Bulk Insert into SQLite: Takes ~15ms for the entire batch
    await prisma.emailJob.createMany({
      data: jobsToInsert,
    });

    // 2. Non-blocking dispatch enqueuing
    const isRedisAvailable = redisConnection.status === 'ready';

    for (const record of createdRecords) {
      const delayMs = Math.max(0, record.scheduledAt.getTime() - now);

      if (isRedisAvailable) {
        emailQueue
          .add(
            'send-email',
            {
              jobRecordId: record.id,
              userId: validUserId || undefined,
              sender: record.sender,
              recipient: record.recipient,
              subject: record.subject,
              body: record.body,
              delayBetweenSeconds: record.delayBetweenSeconds,
              hourlyLimit: record.hourlyLimit,
            },
            {
              delay: delayMs,
              jobId: record.id,
            }
          )
          .catch(() => {
            setTimeout(() => {
              EmailService.processDirectSend(record.id).catch(() => {});
            }, delayMs);
          });
      } else {
        setTimeout(() => {
          EmailService.processDirectSend(record.id).catch(() => {});
        }, delayMs);
      }

      SearchService.indexEmail(record as any).catch(() => {});
    }

    return {
      scheduledCount: createdRecords.length,
      firstScheduledAt: createdRecords[0]?.scheduledAt,
      lastScheduledAt: createdRecords[createdRecords.length - 1]?.scheduledAt,
      jobs: createdRecords,
    };
  }

  public static async getScheduledEmails(params: {
    userId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {
      status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMIT', 'PROCESSING'] },
    };

    const scheduledAndClauses: any[] = [];
    if (params.userId) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: params.userId }, { email: params.userId }] },
      });
      if (user) {
        scheduledAndClauses.push({
          OR: [{ userId: user.id }, { sender: user.email }],
        });
      }
    }

    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      scheduledAndClauses.push({
        OR: [
          { recipient: { contains: term } },
          { subject: { contains: term } },
          { sender: { contains: term } },
        ],
      });
    }

    if (scheduledAndClauses.length > 0) {
      where.AND = scheduledAndClauses;
    }

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  public static async getSentEmails(params: {
    userId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = {
      status: { in: ['SENT', 'FAILED'] },
    };

    const sentAndClauses: any[] = [];
    if (params.userId) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: params.userId }, { email: params.userId }] },
      });
      if (user) {
        sentAndClauses.push({
          OR: [{ userId: user.id }, { sender: user.email }],
        });
      }
    }

    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      sentAndClauses.push({
        OR: [
          { recipient: { contains: term } },
          { subject: { contains: term } },
          { sender: { contains: term } },
        ],
      });
    }

    if (sentAndClauses.length > 0) {
      where.AND = sentAndClauses;
    }

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  public static async processDirectSend(jobRecordId: string) {
    try {
      const record = await prisma.emailJob.findUnique({ where: { id: jobRecordId } });
      if (!record || record.status === 'SENT') return;

      await prisma.emailJob.update({
        where: { id: jobRecordId },
        data: { status: 'PROCESSING' },
      });

      const sendResult = await SmtpService.sendMail({
        jobRecordId: record.id,
        sender: record.sender,
        recipient: record.recipient,
        subject: record.subject,
        body: record.body,
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
      console.log(`[Dispatch] Sent email to ${record.recipient}. Preview URL: ${sendResult.previewUrl || 'N/A'}`);
    } catch (err) {
      console.error(`[Dispatch] Failed to dispatch email ${jobRecordId}:`, (err as Error).message);
      await prisma.emailJob.update({
        where: { id: jobRecordId },
        data: {
          status: 'FAILED',
          errorReason: (err as Error).message,
        },
      }).catch(() => {});
    }
  }

  public static async reconcilePendingJobs() {
    console.log('[Reconciler] Inspecting DB state for unsent jobs after startup...');

    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMIT', 'PROCESSING'] },
      },
    });

    const now = Date.now();

    if (redisConnection.status !== 'ready') {
      console.log(`[Reconciler] Redis is offline. Initializing direct timers for ${pendingEmails.length} pending jobs.`);
      for (const email of pendingEmails) {
        if (email.status === 'PROCESSING') {
          await prisma.emailJob.update({
            where: { id: email.id },
            data: { status: 'SCHEDULED' },
          });
        }
        const delayMs = Math.max(0, email.scheduledAt.getTime() - now);
        setTimeout(() => {
          EmailService.processDirectSend(email.id).catch(() => {});
        }, delayMs);
      }
      return;
    }

    let reEnqueuedCount = 0;

    for (const email of pendingEmails) {
      try {
        const existingJob = await Promise.race([
          emailQueue.getJob(email.id),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 200)),
        ]);

      if (!existingJob) {
        const delayMs = Math.max(0, email.scheduledAt.getTime() - now);

        if (email.status === 'PROCESSING') {
          await prisma.emailJob.update({
            where: { id: email.id },
            data: { status: 'SCHEDULED' },
          });
        }

        const jobPayload: EmailJobData = {
          jobRecordId: email.id,
          userId: email.userId || undefined,
          sender: email.sender,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          delayBetweenSeconds: email.delayBetweenSeconds,
          hourlyLimit: email.hourlyLimit,
        };

        await emailQueue.add('send-email', jobPayload, {
          delay: delayMs,
          jobId: email.id,
        });

        reEnqueuedCount++;
      }
    } catch (err) {
      // Ignore individual job re-enqueue errors
    }
  }

    console.log(`[Reconciler] State restored. Re-enqueued ${reEnqueuedCount} missing jobs.`);
  }
}
