import axios from 'axios';
import { prisma } from '../config/db';
import { config } from '../config/env';

export class SlackService {
  public static getOAuthUrl(userId: string): string {
    const scopes = ['incoming-webhook', 'chat:write'].join(',');
    return `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(
      config.slack.redirectUri
    )}&state=${userId}`;
  }

  public static async handleOAuthCallback(code: string, userId: string) {
    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
          redirect_uri: config.slack.redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      if (!data.ok) {
        throw new Error(data.error || 'Slack OAuth failed');
      }

      const webhookUrl = data.incoming_webhook?.url;
      const channel = data.incoming_webhook?.channel;
      const teamName = data.team?.name;
      const accessToken = data.access_token;

      await prisma.slackIntegration.upsert({
        where: { userId },
        update: {
          webhookUrl,
          channel,
          teamName,
          accessToken,
          isActive: true,
        },
        create: {
          userId,
          webhookUrl,
          channel,
          teamName,
          accessToken,
          isActive: true,
        },
      });

      return { success: true, teamName, channel };
    } catch (error) {
      console.error('[SlackService] OAuth callback error:', (error as Error).message);
      throw error;
    }
  }

  public static async connectWebhook(userId: string, webhookUrl: string, channel?: string) {
    return prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        webhookUrl,
        channel: channel || '#email-scheduler',
        teamName: 'Workspace',
        isActive: true,
      },
      create: {
        userId,
        webhookUrl,
        channel: channel || '#email-scheduler',
        teamName: 'Workspace',
        isActive: true,
      },
    });
  }

  public static async disconnect(userId: string) {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (integration) {
      await prisma.slackIntegration.update({
        where: { userId },
        data: { isActive: false },
      });
    }

    return { success: true };
  }

  public static async getStatus(userId: string) {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.isActive) {
      return { connected: false };
    }

    return {
      connected: true,
      channel: integration.channel,
      teamName: integration.teamName,
      createdAt: integration.createdAt,
    };
  }

  public static async notifyRateLimitHit(params: {
    sender: string;
    hourlyLimit: number;
    userId?: string;
    rescheduledTime: Date;
  }): Promise<boolean> {
    const { sender, hourlyLimit, userId, rescheduledTime } = params;

    let integration = null;
    if (userId) {
      integration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });
    }

    if (!integration) {
      integration = await prisma.slackIntegration.findFirst({
        where: { isActive: true },
      });
    }

    if (!integration || !integration.isActive || !integration.webhookUrl) {
      console.log(`[SlackService] Rate limit hit for sender "${sender}", but Slack is not connected. Skipping alert safely.`);
      return false;
    }

    const payload = {
      text: `⚠️ *ReachInbox Email Scheduler: Hourly Rate Limit Hit*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Sender Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n\`${sender}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${hourlyLimit} emails/hr`,
            },
            {
              type: 'mrkdwn',
              text: `*Trigger Time:*\n${new Date().toLocaleTimeString()}`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Window:*\n${rescheduledTime.toLocaleTimeString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🛡️ *Scheduler Safety*: Excess jobs have NOT been dropped. They are automatically delayed and queued for the next window.',
            },
          ],
        },
      ],
    };

    try {
      await axios.post(integration.webhookUrl, payload, { timeout: 4000 });
      console.log(`[SlackService] Successfully delivered rate limit alert to Slack for sender ${sender}`);
      return true;
    } catch (error) {
      console.error(`[SlackService] Failed to deliver alert to Slack webhook:`, (error as Error).message);
      return false;
    }
  }
}
