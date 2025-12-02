import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TelemetryDto, MetricsDto } from './telemetry.dto';

describe('TelemetryDto Validation', () => {
  describe('Valid data', () => {
    it('should pass validation with correct data', async () => {
      const data = {
        deviceId: 'dev-001',
        siteId: 'site-A',
        ts: '2025-09-01T10:00:00.000Z',
        metrics: {
          temperature: 25,
          humidity: 60,
        },
      };

      const dto = plainToInstance(TelemetryDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('Invalid data', () => {
    it('should fail validation when deviceId is missing', async () => {
      const data = {
        siteId: 'site-A',
        ts: '2025-09-01T10:00:00.000Z',
        metrics: {
          temperature: 25,
          humidity: 60,
        },
      };

      const dto = plainToInstance(TelemetryDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('deviceId');
    });

    it('should fail validation when ts is not ISO8601', async () => {
      const data = {
        deviceId: 'dev-001',
        siteId: 'site-A',
        ts: 'invalid-date',
        metrics: {
          temperature: 25,
          humidity: 60,
        },
      };

      const dto = plainToInstance(TelemetryDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'ts')).toBeTruthy();
    });

    it('should fail validation when temperature is out of range', async () => {
      const data = {
        temperature: 250, // exceeds max of 200
        humidity: 60,
      };

      const dto = plainToInstance(MetricsDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('temperature');
    });

    it('should fail validation when humidity is out of range', async () => {
      const data = {
        temperature: 25,
        humidity: 120, // exceeds max of 100
      };

      const dto = plainToInstance(MetricsDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('humidity');
    });

    it('should fail validation when metrics is missing', async () => {
      const data = {
        deviceId: 'dev-001',
        siteId: 'site-A',
        ts: '2025-09-01T10:00:00.000Z',
      };

      const dto = plainToInstance(TelemetryDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'metrics')).toBeTruthy();
    });
  });
});
