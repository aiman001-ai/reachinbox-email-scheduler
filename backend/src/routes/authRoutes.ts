import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

router.post('/sync', AuthController.syncGoogleUser);
router.get('/me', AuthController.getCurrentUser);

export default router;
