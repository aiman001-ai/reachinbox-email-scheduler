import { Router } from 'express';
import { SlackController } from '../controllers/slackController';

const router = Router();

router.get('/auth-url', SlackController.getAuthUrl);
router.get('/oauth/callback', SlackController.handleCallback);
router.post('/connect-webhook', SlackController.connectWebhook);
router.get('/status', SlackController.getStatus);
router.post('/disconnect', SlackController.disconnect);
router.post('/test-alert', SlackController.triggerTestAlert);

export default router;
