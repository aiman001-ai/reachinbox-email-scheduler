import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-dispatch-queue';

export interface EmailJobData {
  jobRecordId: string;
  userId?: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  delayBetweenSeconds: number;
  hourlyLimit: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

emailQueue.on('error', (err) => {
  console.error('[Queue Error]', err.message);
});
