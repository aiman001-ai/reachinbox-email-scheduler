import { Request, Response } from 'express';
import { SlackService } from '../services/slackService';
import { RateLimitService } from '../services/rateLimitService';

export class SlackController {
  public static async getAuthUrl(req: Request, res: Response): Promise<void> {
    const userId = (req.query.userId as string) || 'default-user';
    const url = SlackService.getOAuthUrl(userId);
    res.json({ url });
  }

  public static async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const code = req.query.code as string;
      const state = (req.query.state as string) || 'default-user';

      if (!code) {
        res.status(400).send('OAuth authorization code missing');
        return;
      }

      await SlackService.handleOAuthCallback(code, state);

      res.redirect('http://localhost:5173?slack=connected');
    } catch (error) {
      console.error('[SlackController.handleCallback] Error:', error);
      res.redirect('http://localhost:5173?slack=error');
    }
  }

  public static async connectWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookUrl, channel, userId = 'default-user' } = req.body;

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        res.status(400).json({ error: 'Valid Slack webhook URL required (https://hooks.slack.com/...)' });
        return;
      }

      const result = await SlackService.connectWebhook(userId, webhookUrl, channel);
      res.json({
        success: true,
        message: 'Slack webhook connected successfully',
        data: result,
      });
    } catch (error) {
      console.error('[SlackController.connectWebhook] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.query.userId as string) || 'default-user';
      const status = await SlackService.getStatus(userId);
      res.json(status);
    } catch (error) {
      console.error('[SlackController.getStatus] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const { userId = 'default-user' } = req.body;
      const result = await SlackService.disconnect(userId);
      res.json(result);
    } catch (error) {
      console.error('[SlackController.disconnect] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async triggerTestAlert(req: Request, res: Response): Promise<void> {
    try {
      const { sender = 'demo@reachinbox.ai', limit = 20, userId = 'default-user' } = req.body;
      const nextWindow = RateLimitService.getNextHourWindowStart();

      const delivered = await SlackService.notifyRateLimitHit({
        sender,
        hourlyLimit: Number(limit),
        userId,
        rescheduledTime: nextWindow,
      });

      res.json({
        success: delivered,
        message: delivered
          ? 'Live test alert sent to connected Slack channel'
          : 'Slack is not connected or webhook delivery failed',
      });
    } catch (error) {
      console.error('[SlackController.triggerTestAlert] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
