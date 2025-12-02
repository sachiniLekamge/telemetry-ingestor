import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Telemetry Ingestor (e2e)', () => {
  let app: INestApplication;
  const authToken = process.env.INGEST_TOKEN || 'secret123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBeDefined();
          expect(res.body.services).toHaveProperty('mongodb');
          expect(res.body.services).toHaveProperty('redis');
        });
    });
  });

  describe('/api/v1/telemetry (POST)', () => {
    it('should ingest valid telemetry data', () => {
      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: 'dev-e2e-001',
          siteId: 'site-test',
          ts: '2025-09-01T10:00:00.000Z',
          metrics: {
            temperature: 25,
            humidity: 60,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Telemetry ingested successfully');
          expect(res.body.count).toBe(1);
        });
    });

    it('should trigger alert for high temperature', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: 'dev-e2e-hot',
          siteId: 'site-test',
          ts: '2025-09-01T10:05:00.000Z',
          metrics: {
            temperature: 55,
            humidity: 60,
          },
        })
        .expect(201);

      // Alert should be sent to webhook (check webhook.site)
    });

    it('should reject telemetry without authorization', () => {
      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .send({
          deviceId: 'dev-e2e-002',
          siteId: 'site-test',
          ts: '2025-09-01T10:01:00.000Z',
          metrics: {
            temperature: 25,
            humidity: 60,
          },
        })
        .expect(401);
    });

    it('should reject invalid telemetry data', () => {
      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: 'dev-e2e-003',
          siteId: 'site-test',
          ts: 'invalid-date',
          metrics: {
            temperature: 25,
            humidity: 60,
          },
        })
        .expect(400);
    });

    it('should reject out-of-range metrics', () => {
      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: 'dev-e2e-004',
          siteId: 'site-test',
          ts: '2025-09-01T10:02:00.000Z',
          metrics: {
            temperature: 250, // exceeds max
            humidity: 60,
          },
        })
        .expect(400);
    });

    it('should ingest array of telemetry data', () => {
      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${authToken}`)
        .send([
          {
            deviceId: 'dev-e2e-005',
            siteId: 'site-test',
            ts: '2025-09-01T10:03:00.000Z',
            metrics: { temperature: 22, humidity: 55 },
          },
          {
            deviceId: 'dev-e2e-006',
            siteId: 'site-test',
            ts: '2025-09-01T10:04:00.000Z',
            metrics: { temperature: 24, humidity: 58 },
          },
        ])
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(2);
        });
    });
  });

  describe('/api/v1/devices/:deviceId/latest (GET)', () => {
    beforeAll(async () => {
      // Insert test data
      await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: 'dev-e2e-latest',
          siteId: 'site-test',
          ts: '2025-09-01T12:00:00.000Z',
          metrics: { temperature: 28, humidity: 62 },
        });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    it('should return latest telemetry for device', () => {
      return request(app.getHttpServer())
        .get('/api/v1/devices/dev-e2e-latest/latest')
        .expect(200)
        .expect((res) => {
          expect(res.body.deviceId).toBe('dev-e2e-latest');
          expect(res.body.metrics).toHaveProperty('temperature');
          expect(res.body.metrics).toHaveProperty('humidity');
        });
    });

    it('should return 404 for non-existent device', () => {
      return request(app.getHttpServer())
        .get('/api/v1/devices/non-existent-device/latest')
        .expect(404);
    });
  });

  describe('/api/v1/sites/:siteId/summary (GET)', () => {
    beforeAll(async () => {
      // Insert test data for summary
      const testData = [
        {
          deviceId: 'dev-summary-1',
          siteId: 'site-summary',
          ts: '2025-09-01T10:00:00.000Z',
          metrics: { temperature: 20, humidity: 50 },
        },
        {
          deviceId: 'dev-summary-2',
          siteId: 'site-summary',
          ts: '2025-09-01T11:00:00.000Z',
          metrics: { temperature: 30, humidity: 70 },
        },
        {
          deviceId: 'dev-summary-1',
          siteId: 'site-summary',
          ts: '2025-09-01T12:00:00.000Z',
          metrics: { temperature: 25, humidity: 60 },
        },
      ];

      for (const data of testData) {
        await request(app.getHttpServer())
          .post('/api/v1/telemetry')
          .set('Authorization', `Bearer ${authToken}`)
          .send(data);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    it('should return aggregated summary for site', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sites/site-summary/summary')
        .query({
          from: '2025-09-01T00:00:00.000Z',
          to: '2025-09-02T00:00:00.000Z',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('count');
          expect(res.body).toHaveProperty('avgTemperature');
          expect(res.body).toHaveProperty('maxTemperature');
          expect(res.body).toHaveProperty('avgHumidity');
          expect(res.body).toHaveProperty('maxHumidity');
          expect(res.body).toHaveProperty('uniqueDevices');
          expect(res.body.count).toBeGreaterThanOrEqual(3);
          expect(res.body.uniqueDevices).toBeGreaterThanOrEqual(2);
        });
    });

    it('should reject invalid date format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sites/site-summary/summary')
        .query({
          from: 'invalid-date',
          to: '2025-09-02T00:00:00.000Z',
        })
        .expect(400);
    });
  });
});
