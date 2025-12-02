import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TelemetryService } from './telemetry.service';
import { RedisService } from './redis.service';
import { AlertService } from './alert.service';
import { Telemetry } from './schemas/telemetry.schema';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let mockTelemetryModel: any;
  let mockRedisService: any;
  let mockAlertService: any;

  beforeEach(async () => {
    // Mock implementations
    mockTelemetryModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue(dto),
    }));
    mockTelemetryModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    });
    mockTelemetryModel.aggregate = jest.fn();
    mockTelemetryModel.db = { readyState: 1 };

    mockRedisService = {
      setLatest: jest.fn(),
      getLatest: jest.fn(),
      ping: jest.fn().mockResolvedValue(true),
    };

    mockAlertService = {
      checkAndSendAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: getModelToken(Telemetry.name),
          useValue: mockTelemetryModel,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestTelemetry', () => {
    it('should save telemetry to MongoDB and Redis', async () => {
      const telemetryData = {
        deviceId: 'dev-001',
        siteId: 'site-A',
        ts: '2025-09-01T10:00:00.000Z',
        metrics: { temperature: 25, humidity: 60 },
      };

      await service.ingestTelemetry(telemetryData);

      expect(mockTelemetryModel).toHaveBeenCalledWith({
        ...telemetryData,
        ts: new Date(telemetryData.ts),
      });
      expect(mockRedisService.setLatest).toHaveBeenCalledWith(
        'dev-001',
        telemetryData,
      );
    });

    it('should trigger alert check for high temperature', async () => {
      const telemetryData = {
        deviceId: 'dev-002',
        siteId: 'site-A',
        ts: '2025-09-01T10:00:00.000Z',
        metrics: { temperature: 55, humidity: 60 },
      };

      await service.ingestTelemetry(telemetryData);

      expect(mockAlertService.checkAndSendAlert).toHaveBeenCalledWith(
        'dev-002',
        'site-A',
        telemetryData.ts,
        telemetryData.metrics,
      );
    });

    it('should process array of telemetry data', async () => {
      const telemetryArray = [
        {
          deviceId: 'dev-001',
          siteId: 'site-A',
          ts: '2025-09-01T10:00:00.000Z',
          metrics: { temperature: 25, humidity: 60 },
        },
        {
          deviceId: 'dev-002',
          siteId: 'site-A',
          ts: '2025-09-01T10:01:00.000Z',
          metrics: { temperature: 30, humidity: 65 },
        },
      ];

      await service.ingestTelemetry(telemetryArray);

      expect(mockTelemetryModel).toHaveBeenCalledTimes(2);
      expect(mockRedisService.setLatest).toHaveBeenCalledTimes(2);
    });
  });

  describe('getLatest', () => {
    it('should return cached data from Redis', async () => {
      const cachedData = {
        deviceId: 'dev-001',
        siteId: 'site-A',
        ts: '2025-09-01T10:00:00.000Z',
        metrics: { temperature: 25, humidity: 60 },
      };

      mockRedisService.getLatest.mockResolvedValue(cachedData);

      const result = await service.getLatest('dev-001');

      expect(result).toEqual(cachedData);
      expect(mockRedisService.getLatest).toHaveBeenCalledWith('dev-001');
      expect(mockTelemetryModel.findOne).not.toHaveBeenCalled();
    });

    it('should fallback to MongoDB when Redis cache misses', async () => {
      const mongoData = {
        deviceId: 'dev-001',
        siteId: 'site-A',
        ts: new Date('2025-09-01T10:00:00.000Z'),
        metrics: { temperature: 25, humidity: 60 },
      };

      mockRedisService.getLatest.mockResolvedValue(null);
      mockTelemetryModel.findOne().exec.mockResolvedValue(mongoData);

      const result = await service.getLatest('dev-001');

      expect(result.deviceId).toEqual('dev-001');
      expect(mockTelemetryModel.findOne).toHaveBeenCalledWith({
        deviceId: 'dev-001',
      });
      expect(mockRedisService.setLatest).toHaveBeenCalled();
    });
  });

  describe('getSiteSummary', () => {
    it('should aggregate data for a site', async () => {
      const summaryData = [
        {
          count: 10,
          avgTemperature: 25.5,
          maxTemperature: 30,
          avgHumidity: 65.2,
          maxHumidity: 80,
          uniqueDevices: 3,
        },
      ];

      mockTelemetryModel.aggregate.mockResolvedValue(summaryData);

      const result = await service.getSiteSummary(
        'site-A',
        '2025-09-01T00:00:00.000Z',
        '2025-09-02T00:00:00.000Z',
      );

      expect(result).toEqual(summaryData[0]);
      expect(mockTelemetryModel.aggregate).toHaveBeenCalled();
    });

    it('should return default values when no data found', async () => {
      mockTelemetryModel.aggregate.mockResolvedValue([]);

      const result = await service.getSiteSummary(
        'site-B',
        '2025-09-01T00:00:00.000Z',
        '2025-09-02T00:00:00.000Z',
      );

      expect(result).toEqual({
        count: 0,
        avgTemperature: 0,
        maxTemperature: 0,
        avgHumidity: 0,
        maxHumidity: 0,
        uniqueDevices: 0,
      });
    });
  });
});
