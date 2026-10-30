import { prisma } from '../config/db';
import { emailQueue, EmailJobData } from '../queues/emailQueue';
import { SearchService } from './searchService';

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

    const createdRecords = [];

    for (let index = 0; index < recipients.length; index++) {
      const recipient = recipients[index].trim();
      if (!recipient) continue;

      const scheduledTimestamp = effectiveStart + index * delayBetweenSeconds * 1000;
      const scheduledAt = new Date(scheduledTimestamp);

      const emailRecord = await prisma.emailJob.create({
        data: {
          userId: validUserId,
          sender,
          recipient,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt,
          delayBetweenSeconds,
          hourlyLimit,
        },
      });

      const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());

      const jobPayload: EmailJobData = {
        jobRecordId: emailRecord.id,
        userId: validUserId || undefined,
        sender,
        recipient,
        subject,
        body,
        delayBetweenSeconds,
        hourlyLimit,
      };

      await emailQueue.add('send-email', jobPayload, {
        delay: delayMs,
        jobId: emailRecord.id,
      });

      SearchService.indexEmail(emailRecord).catch(() => {});

      createdRecords.push(emailRecord);
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
      status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMIT'] },
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

  public static async reconcilePendingJobs() {
    console.log('[Reconciler] Inspecting DB state for unsent jobs after startup...');

    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'DELAYED_RATE_LIMIT', 'PROCESSING'] },
      },
    });

    let reEnqueuedCount = 0;
    const now = Date.now();

    for (const email of pendingEmails) {
      const existingJob = await emailQueue.getJob(email.id);

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
    }

    console.log(`[Reconciler] State restored. Re-enqueued ${reEnqueuedCount} missing jobs.`);
  }
}
