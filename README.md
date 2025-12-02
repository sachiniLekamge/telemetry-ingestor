# IoT Telemetry Ingestor - Technical Exercise

A minimal IoT telemetry ingestion service built with NestJS, TypeScript, MongoDB Atlas, and Redis. Accepts JSON telemetry readings, stores them in MongoDB, caches latest readings in Redis, and sends webhook alerts when thresholds are exceeded.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/telemetry?retryWrites=true&w=majority
REDIS_URL=redis://localhost:6379
ALERT_WEBHOOK_URL=https://webhook.site/96951d2c-431f-452d-84bf
INGEST_TOKEN=secret123
PORT=3000
```

**Note**:

- MongoDB Atlas connection string included (or use your own free M0 cluster)
- Redis: Run locally with `docker run -d -p 6379:6379 redis` or use Upstash (I'm using Upstash here)
- Get your unique webhook URL from [webhook.site](https://webhook.site/)

### 3. Run the Application

```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

Server will start at `http://localhost:3000`

## Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:cov
```

## Webhook URL (viewable)

[https://webhook.site/#!/view/96951d2c-431f-452d-84bf-272c8d87d5ab](https://webhook.site/#!/view/96951d2c-431f-452d-84bf-272c8d87d5ab)

## AI Assistance Used

During development, I used AI (Claude) to assist with the following aspects:

1. **NestJS Module Structure**: Used AI to generate the initial project structure with DTOs, schemas, and service boilerplate. I reviewed and modified the code to ensure proper validation rules, add custom indexes to the MongoDB schema, and implement the specific business logic required.

2. **MongoDB Aggregation Pipeline**: Asked AI to help construct the site summary aggregation query with proper grouping and date filtering. I refined the pipeline to add rounding for average values (2 decimal places) and handle empty result sets by returning default zero values.

3. **Test Scaffolding**: Generated initial unit and E2E test structure using AI prompts. I extended the tests with additional edge cases including out-of-range metric validation, authentication failures (401 responses), cache fallback scenarios, and array ingestion testing.

4. **Redis Alert Deduplication**: Consulted AI for the optimal approach to implement 60-second alert deduplication. I implemented the suggested Redis `SETNX` with TTL approach and added custom error handling to ensure alert failures don't block telemetry ingestion.

5. **Error Handling Patterns**: Used AI to explore different approaches for async error handling in webhook calls and database operations. I customized the timeout values (5s for webhooks) and implemented a fire-and-forget pattern for alerts to prevent blocking the ingestion pipeline.

**Note:** All AI-generated code was carefully reviewed, tested, and modified to ensure correctness, security, and full compliance with the assignment requirements. I take complete responsibility for the final implementation.

## API Endpoints

### 1. Ingest Telemetry

**POST** `/api/v1/telemetry`

**Headers:**

```
Authorization: Bearer secret123
Content-Type: application/json
```

**Body (single):**

```json
{
  "deviceId": "dev-001",
  "siteId": "site-A",
  "ts": "2025-09-01T10:00:00.000Z",
  "metrics": {
    "temperature": 25,
    "humidity": 60
  }
}
```

**Body (array):**

```json
[
  {
    "deviceId": "dev-001",
    "siteId": "site-A",
    "ts": "2025-09-01T10:00:00.000Z",
    "metrics": { "temperature": 25, "humidity": 60 }
  }
]
```

### 2. Get Latest Reading

**GET** `/api/v1/devices/:deviceId/latest`

Returns latest telemetry from Redis cache (falls back to MongoDB if cache miss).

### 3. Get Site Summary

**GET** `/api/v1/sites/:siteId/summary?from=ISO&to=ISO`

**Example:**

```bash
GET /api/v1/sites/site-A/summary?from=2025-09-01T00:00:00.000Z&to=2025-09-02T00:00:00.000Z
```

**Response:**

```json
{
  "count": 150,
  "avgTemperature": 26.5,
  "maxTemperature": 45.2,
  "avgHumidity": 62.3,
  "maxHumidity": 89.0,
  "uniqueDevices": 5
}
```

### 4. Health Check

**GET** `/api/v1/health`

Returns MongoDB and Redis connection status.

## Alert Configuration

**Webhook URL:** `https://webhook.site/YOUR-UNIQUE-ID-HERE`

Alerts are triggered when:

- **Temperature > 50°C** → Sends `HIGH_TEMPERATURE` alert
- **Humidity > 90%** → Sends `HIGH_HUMIDITY` alert

**Alert Payload:**

```json
{
  "deviceId": "dev-002",
  "siteId": "site-A",
  "ts": "2025-09-01T10:05:00.000Z",
  "reason": "HIGH_TEMPERATURE",
  "value": 55.2
}
```

**Alert Deduplication:** 60-second window per device/reason combination (prevents alert flooding).

## Quick Verification

After starting the server, test with these curl commands:

```bash
# 1. Ingest telemetry with alert trigger (temperature > 50)
curl -X POST http://localhost:3000/api/v1/telemetry \
  -H "Authorization: Bearer secret123" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"dev-002","siteId":"site-A","ts":"2025-09-01T10:00:30.000Z","metrics":{"temperature":51.2,"humidity":55}}'

# 2. Get latest reading
curl http://localhost:3000/api/v1/devices/dev-002/latest

# 3. Get site summary
curl "http://localhost:3000/api/v1/sites/site-A/summary?from=2025-09-01T00:00:00.000Z&to=2025-09-02T00:00:00.000Z"

# 4. Health check
curl http://localhost:3000/api/v1/health
```

**Check webhook.site** to see the alert that was triggered!

## Quality & Security Features

- ✅ DTO validation using `class-validator`
- ✅ Bearer token authentication on ingest endpoint
- ✅ Payload size limits (1MB max)
- ✅ Structured logging (no secrets in logs)
- ✅ Request timeouts (5s for webhooks)
- ✅ Environment-based configuration
- ✅ MongoDB indexes for query optimization
- ✅ Redis caching with 24h TTL
- ✅ Alert deduplication (60s window)
- ✅ Health check for monitoring

## Test Coverage

**Unit Tests:**

- DTO validation (missing fields, invalid formats, out-of-range values)
- Telemetry ingestion and storage
- Redis cache updates
- Alert triggering logic
- MongoDB aggregation correctness
- Authentication guard (401 without token)

**E2E Tests:**

- ⚠️ Currently not working at the moment. Will work on in after the time limit

## Project Structure

```
telemetry-ingestor/
├── src/
│   ├── telemetry/
│   │   ├── dto/
│   │   │   └── telemetry.dto.ts          # Request validation DTOs
│   │   ├── schemas/
│   │   │   └── telemetry.schema.ts       # MongoDB schema with indexes
│   │   ├── guards/
│   │   │   └── auth.guard.ts             # Bearer token authentication
│   │   ├── telemetry.controller.ts       # REST API endpoints
│   │   ├── telemetry.service.ts          # Core business logic
│   │   ├── redis.service.ts              # Redis caching layer
│   │   ├── alert.service.ts              # Webhook alert handling
│   │   └── telemetry.module.ts           # Module configuration
│   ├── app.module.ts                      # Main application module
│   └── main.ts                            # Application entry point
├── test/
│   └── app.e2e-spec.ts                    # End-to-end tests
├── .env                                   # Environment configuration (not in repo)
├── .env.example                           # Environment template
├── package.json
└── README.md
```

## Technologies Used

- **Framework:** NestJS 10.x with TypeScript
- **Database:** MongoDB Atlas (free M0 cluster)
- **Cache:** Redis (ioredis client)
- **Validation:** class-validator & class-transformer
- **HTTP Client:** Axios
- **Testing:** Jest & Supertest
- **Security:** Helmet, Bearer token auth, payload limits

---

**Author:** Sachini Lekamge  
**Date:** December 2025  
**Assignment:** Associate Software Engineer - Cloud & IoT Solutions

