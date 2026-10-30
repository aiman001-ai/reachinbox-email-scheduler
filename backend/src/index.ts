import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config/env';
import { connectDatabase } from './config/db';
import { initElasticsearch, getEsConnectionStatus } from './config/elasticsearch';
import { emailQueue } from './queues/emailQueue';
import { createEmailWorker } from './workers/emailWorker';
import { EmailService } from './services/emailService';

import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import authRoutes from './routes/authRoutes';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    elasticsearch: getEsConnectionStatus(),
  });
});

const startServer = async () => {
  try {
    await connectDatabase();
    await initElasticsearch();

    const server = app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`  ReachInbox Email Job Scheduler Backend`);
      console.log(`  API Server:        http://localhost:${config.port}`);
      console.log(`  BullMQ Dashboard:  http://localhost:${config.port}/admin/queues`);
      console.log(`=======================================================`);
    });

    let worker: any = null;
    setTimeout(async () => {
      try {
        worker = createEmailWorker();
        console.log(`[Worker] Email dispatcher worker started with concurrency ${config.worker.concurrency}`);
        await EmailService.reconcilePendingJobs();
      } catch (workerErr) {
        console.warn('[Worker] Worker/Queue initialization deferred or offline:', (workerErr as Error).message);
      }
    }, 100);

    const shutdown = async () => {
      console.log('\n[Server] Shutting down gracefully...');
      await worker.close();
      await emailQueue.close();
      server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
};

startServer();
