import { Router } from 'express';
import multer from 'multer';
import { EmailController } from '../controllers/emailController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/schedule', EmailController.schedule);
router.post('/upload-leads', upload.single('file'), EmailController.uploadLeads);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.get('/search', EmailController.search);
router.get('/stats', EmailController.getStats);
router.get('/preview/:id', EmailController.previewEmail);

export default router;
