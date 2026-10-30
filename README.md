# ReachInbox Email Job Scheduler

An email scheduling system and monitoring dashboard built for outreach campaigns. The backend handles delayed scheduling, rate limiting, and email dispatching via BullMQ and Redis, while the frontend provides a management interface with Google OAuth and Slack alert integration.

---

## Architecture Overview

```
                      +-----------------------------+
                      |       React Dashboard       |
                      | (Google OAuth, Slack Modal) |
                      +--------------+--------------+
                                     |
                                     | HTTP / REST
                                     v
                      +-----------------------------+
                      |     Express API Gateway     |
                      |  (Lead Parser, Bull Board)  |
                      +------+---------------+------+
                             |               |
              Enqueues jobs  |               | Persists records
                             v               v
                      +-------------+ +-------------+
                      |   Redis 7   | |   SQLite    |
                      |   BullMQ    | |   Prisma    |
                      +------+------+ +-------------+
                             |
                  Pulls jobs | (Concurrency pool)
                             v
              +------------------------------+
              |    BullMQ Worker Service     |
              |  - Minimum send delay        |
              |  - Hourly rate limit checks  |
              |  - Idempotency guard         |
              +-------+--------------+-------+
                      |              |
      Limit triggered |              | On dispatch
                      v              v
              +---------------+ +------------------+
              | Slack Webhook | |  Ethereal SMTP   |
              | Notifications | | (Preview links)  |
              +---------------+ +------------------+
```

---

## Key Design Decisions & Implementation

### 1. Delayed Scheduling without Cron Jobs
- Rather than running polling intervals or cron jobs (`node-cron`, `setInterval`), scheduling relies entirely on BullMQ delayed jobs backed by Redis sorted sets (`zset`).
- When an outreach sequence is submitted, each recipient receives a calculated execution timestamp (`scheduledAt`).
- The job is added to BullMQ with `delay = scheduledAt - Date.now()`. Redis atomically promotes the job to active state when the delay expires.

### 2. Persistence and Recovery
- All job records are stored in the database (`email_jobs` table) with statuses: `SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`, and `DELAYED_RATE_LIMIT`.
- When the server boots up, a reconciliation function checks for any pending jobs in the database. If a job is missing from Redis (due to a restart or cache flush), it is automatically re-enqueued with its remaining delay.
- An idempotency check runs before each send: if a record is already marked `SENT`, duplicate delivery is prevented.

### 3. Rate Limiting and ESP Throttling
- **Throttling**: The worker enforces a configurable delay between sends (`MIN_DELAY_BETWEEN_EMAILS`, default: 2 seconds) to avoid trigger-happy SMTP limits.
- **Hourly Limits**: Tracked per sender in Redis using hourly buckets (`ratelimit:{sender}:{YYYY-MM-DD-HH}`).
- **Overflow Handling**: If a sender exceeds their hourly quota, jobs are not dropped. Instead, the worker calculates the time remaining until the next hour, flags the job as `DELAYED_RATE_LIMIT`, and reschedules it to run at the start of the next hour.
- **Slack Alerting**: When a limit is hit for the first time in an hour window, a notification is sent to the configured Slack webhook channel.

---

## Features

### Backend
- **Queue Pipeline**: BullMQ delayed jobs with configurable concurrency.
- **Database**: SQLite with Prisma ORM for tracking outreach status.
- **Mock SMTP**: Integrated Ethereal Email with live preview URLs for sent messages.
- **Full-Text Search**: Search endpoint supporting subject and recipient queries.
- **Queue Dashboard**: Embedded Bull-Board available at `/admin/queues`.
- **Slack Alerts**: Webhook notification dispatch on sender rate-limit events.

### Frontend
- **Authentication**: Google OAuth sign-in.
- **Campaign Composer**: Subject, body, scheduled start time, inter-send delay, and hourly limit controls.
- **Lead Upload**: Drag-and-drop CSV/TXT file parser with email validation.
- **Tables**: Tabs for scheduled emails and dispatched emails with direct links to Ethereal previews.
- **Metrics Bar**: Summary of queue depth, sent totals, worker concurrency, and active delays.
- **Slack Configuration**: Modal to connect incoming webhook and send live test alerts.

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18+)
- Redis running on `127.0.0.1:6379`

### 1. Backend

```bash
cd backend

# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

The backend server runs on `http://localhost:4000`.  
Queue monitoring dashboard is available at `http://localhost:4000/admin/queues`.

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will run on `http://localhost:5173`.

---

## Environment Configuration

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Express server port |
| `DATABASE_URL` | `"file:./dev.db"` | Prisma SQLite database path |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_URL` | *(optional)* | Full Redis connection string |
| `WORKER_CONCURRENCY` | `5` | Simultaneous worker jobs |
| `MIN_DELAY_BETWEEN_EMAILS` | `2` | Delay between consecutive emails (seconds) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `200` | Hourly send threshold per sender |
| `SMTP_HOST` | `smtp.ethereal.email` | Ethereal SMTP host |
| `SMTP_PORT` | `587` | Ethereal SMTP port |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API URL (e.g., `http://localhost:4000/api`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
