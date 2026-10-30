export interface EmailJob {
  id: string;
  userId?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DELAYED_RATE_LIMIT';
  scheduledAt: string;
  sentAt?: string | null;
  delayBetweenSeconds: number;
  hourlyLimit: number;
  etherealMessageId?: string | null;
  etherealPreviewUrl?: string | null;
  errorReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSchedulePayload {
  userId?: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenSeconds?: number;
  hourlyLimit?: number;
}

export interface SlackStatus {
  connected: boolean;
  channel?: string;
  teamName?: string;
  createdAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface QueueMetrics {
  database: {
    scheduled: number;
    sent: number;
    failed: number;
  };
  queue: {
    delayed: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  concurrency: number;
  minDelaySeconds: number;
}
