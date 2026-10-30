# ReachInbox — Distributed Email Job Scheduler

A distributed email scheduling service and real-time dashboard built for reliable, high-throughput cold email outreach workflows. Built with Express.js, TypeScript, BullMQ, Redis, PostgreSQL (Prisma), Ethereal SMTP, and Elasticsearch.

---

## Architecture Overview

```
                          ┌────────────────────────────────┐
                          │   React + Tailwind Dashboard   │
                          │   (Google OAuth + Slack Setup) │
                          └───────────────┬────────────────┘
                                          │ HTTP / REST
                                          ▼
                          ┌────────────────────────────────┐
                          │    Express.js API Gateway      │
                          │   (Lead Parser, Bull-Board)    │
                          └──────┬───────────────┬─────────┘
                                 │               │
                  Enqueues jobs  │               │ Persists state
                                 ▼               ▼
                      ┌───────────────┐   ┌───────────────┐
                      │ Redis 7       │   │ Relational DB │
                      │ BullMQ Queue  │   │ Prisma ORM    │
                      └───────┬───────┘   └───────────────┘
                              │
               Pulls jobs     │ (Configurable Concurrency)
                              ▼
                      ┌────────────────────────────────┐
                      │    BullMQ Worker Dispatcher    │
                      │ ├── Sliding Rate Limiter       │
                      │ ├── Safe Provider Throttling   │
                      │ └── Idempotency Guard          │
                      └───┬────────────┬───────────┬───┘
                          │            │           │
     On Hourly Limit Hit  │            │           │ On Dispatch
                          ▼            ▼           ▼
                   ┌────────────┐┌───────────┐┌───────────────────┐
                   │ Live Slack ││ Ethereal  ││ Elasticsearch 8   │
                   │ Webhook    ││ Fake SMTP ││ Full-Text Index   │
                   └────────────┘└───────────┘└───────────────────┘
```

### 1. Scheduling Pipeline (No Cron)
- Scheduled outreach jobs never use recurring polling loops or cron libraries (`node-cron`, `agenda`, etc.).
- When an outreach request is submitted, target execution timestamps (`scheduledAt`) are calculated. For bulk uploads, sends are staggered automatically by `delayBetweenSeconds`.
- The backend writes the record to the relational database (`email_jobs` table) with status `SCHEDULED`.
- A delayed job is pushed to BullMQ with `delay = Math.max(0, scheduledAt - Date.now())` and an idempotent `jobId = emailRecord.id`.
- BullMQ leverages Redis sorted sets (`zset`) with execution timestamps as scores. When a job's time arrives, Redis atomically transitions the job to the waiting stream for active worker processing.

### 2. Persistence & Server Restart Recovery
- **Redis Durability**: Redis is configured with Append-Only File (`appendonly yes`), ensuring delayed timers persist across container or service restarts.
- **Relational Ground Truth**: PostgreSQL/SQLite acts as the primary source of truth. All job states (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`, `DELAYED_RATE_LIMIT`) are tracked relationally.
- **Startup Reconciler**: When the Express service boots, `EmailService.reconcilePendingJobs()` scans the database for any pending/processing emails where `scheduledAt > now`. If a job is absent from Redis (e.g. cold Redis restart or ungraceful shutdown mid-process), it re-enqueues the job with its remaining delay window.
- **Idempotency**: Before dispatching an email, the worker checks whether the record in the database is already marked `SENT`. If so, the job is discarded safely without duplicate sends.

### 3. Concurrency, Throttling & Hourly Rate Limiting
- **Configurable Worker Concurrency**: BullMQ worker concurrency is set via `WORKER_CONCURRENCY` (default: 5). Multiple worker instances can pull jobs concurrently without race conditions.
- **Provider Throttling**: Each worker enforces a mandatory minimum delay between consecutive emails (`MIN_DELAY_BETWEEN_EMAILS`, default: 2 seconds) to simulate real-world ESP provider throttling.
- **Redis-Backed Hourly Rate Limiting**:
  - Tracked on a per-sender basis using time-bucketed Redis keys: `ratelimit:{sender}:{YYYY-MM-DD-HH}`.
  - Counters are incremented atomically via Redis `MULTI`/`EXEC` pipelines with a 2-hour TTL.
  - **Behavior when limit is reached**: Excess jobs are **never dropped or failed**. When `currentCount >= hourlyLimit`, the worker computes the remaining milliseconds until the next hour window (`nextWindowStart`), updates the record status to `DELAYED_RATE_LIMIT`, and re-enqueues the job with a delay targeting the top of the subsequent hour.
  - **Live Slack Alerting**: The first time a sender crosses their hourly limit in a window, an alert key (`alert_sent:{sender}:{window}`) is written to Redis and a formatted Slack Block Kit alert is dispatched live to the connected Slack webhook/channel.

---

## Features

### Backend
- **Core Scheduler**: Express + TypeScript + BullMQ delayed jobs (no cron).
- **Relational Persistence**: Prisma ORM schema migrations and relational tables.
- **Zero-Loss Restart**: Database-backed startup reconciliation and Redis persistence.
- **Fake SMTP Engine**: Ethereal Email integration with test credentials and live preview URLs.
- **Elasticsearch Integration**: Automatic indexing of scheduled/sent emails with multi-field fuzzy search and database fallback.
- **Real-Time Queue Dashboard**: Embedded Bull-Board at `/admin/queues` showing active, delayed, and completed jobs.
- **Concurrency & Throttling**: Configurable concurrency pool and inter-send delay throttling.
- **Safe Hourly Rate Limiting**: Time-window Redis counters with automatic carry-over to the next hour.
- **Live Slack Alerts**: Real OAuth authorize flow & webhook support sending alerts upon rate-limit hits.

### Frontend
- **Google OAuth Login**: Real Google login integration with user avatar, name, and email header display.
- **Main Dashboard**: Sleek SaaS UI matching ReachInbox design language.
- **Compose Outreach**: Subject, body, start time picker, delay throttle slider, and hourly limit field.
- **Lead CSV / TXT Upload**: Drag-and-drop file parser automatically validating email syntax and displaying detected lead count.
- **Scheduled Emails Table**: Filterable table with recipient, subject, scheduled time, and rate-limit badges.
- **Sent Emails Table**: Sent timestamp, delivery status, and direct links to view Ethereal email previews.
- **Live Metrics Bar**: Real-time display of queue depth, sent counts, worker concurrency, and throttling parameters.
- **Slack Integration Modal**: Connect modal with webhook input and one-click "Send Live Test Alert" button.

---

## Getting Started

### Prerequisites
- Node.js (v18+) & npm
- Redis running on `127.0.0.1:6379` (via local binary or Docker)

---

### Step 1: Backend Setup & Launch

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Generate Prisma Client and apply database schema:
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```

Backend is live at:
- **API Server**: `http://localhost:4000`
- **BullMQ Live Queue Dashboard**: `http://localhost:4000/admin/queues`

---

### Step 2: Frontend Setup & Launch

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Add your Google OAuth Client ID:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

4. Start Vite development server:
   ```bash
   npm run dev
   ```

Frontend is live at:
- **Dashboard**: `http://localhost:5173`

---

## Configuration Reference (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Express HTTP server port |
| `DATABASE_URL` | `"file:./dev.db"` | Relational database connection string |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `WORKER_CONCURRENCY` | `5` | Number of simultaneous jobs BullMQ worker processes |
| `MIN_DELAY_BETWEEN_EMAILS` | `2` | Minimum inter-send delay in seconds |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `200` | Max emails permitted per sender per hour |
| `SMTP_USER` | *(empty)* | Ethereal user (auto-created if blank) |
| `SMTP_PASS` | *(empty)* | Ethereal pass (auto-created if blank) |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch node URI |
| `SLACK_CLIENT_ID` | *(optional)* | Slack OAuth App Client ID |
| `SLACK_CLIENT_SECRET` | *(optional)* | Slack OAuth App Secret |

---

## Walkthrough / Verification Guide

1. **Authentication**
   - Open `http://localhost:5173`.
   - Sign in using your Google account via real Google OAuth.
   - Header displays user avatar, name, email, and live BullMQ Queue link.

2. **Compose & Lead Upload**
   - Click **"+ Compose New Email"**.
   - Enter sender (`outreach@reachinbox.ai`), subject, and body.
   - Upload [`sample-leads.csv`](./sample-leads.csv). The parser automatically detects valid recipient emails.
   - Set delay (e.g. 2s) and schedule.
   - Click **"Schedule"**. Emails enter the **"Scheduled Emails"** tab.

3. **Queue Processing & Live Ethereal Emails**
   - Switch to the **"Sent Emails"** tab. Status transitions to `Sent` in real-time as the worker dispatches.
   - Click **"View Email"** link on any sent email to open the live Ethereal HTML preview in your browser.
   - Open `http://localhost:4000/admin/queues` to inspect BullMQ jobs in real time.

4. **Server Restart Persistence**
   - Schedule an email 1-2 minutes in advance.
   - Stop the backend server (`Ctrl + C`).
   - Restart the backend server (`npm run dev`).
   - Notice log: `[Reconciler] State restored. Re-enqueued missing jobs.`
   - Email sends at the right time without duplicate dispatches.

5. **Slack Notification & Rate Limiting**
   - Open **"Connect Slack"** modal, connect incoming webhook or OAuth.
   - Click **"Send Live Test Alert"** to verify Slack delivery.
   - When hourly quota is reached, excess jobs are rescheduled to the next window and Slack alert is sent.
