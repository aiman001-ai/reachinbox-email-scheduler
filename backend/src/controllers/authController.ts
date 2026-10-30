import { Request, Response } from 'express';
import { prisma } from '../config/db';

export class AuthController {
  public static async syncGoogleUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, avatar, googleId } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: name || undefined,
          avatar: avatar || undefined,
        },
        create: {
          email,
          name: name || email.split('@')[0],
          avatar: avatar || null,
        },
      });

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error('[AuthController.syncGoogleUser] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  public static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.query;
      if (!email) {
        res.status(400).json({ error: 'Email parameter required' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email: email as string },
        include: {
          slackIntegration: true,
        },
      });

      res.json({ user });
    } catch (error) {
      console.error('[AuthController.getCurrentUser] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
