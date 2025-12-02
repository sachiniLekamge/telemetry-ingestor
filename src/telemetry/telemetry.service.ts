import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telemetry, TelemetryDocument } from './schemas/telemetry.schema';
import { TelemetryDto } from './dto/telemetry.dto';
import { RedisService } from './redis.service';
import { AlertService } from './alert.service';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectModel(Telemetry.name)
    private telemetryModel: Model<TelemetryDocument>,
    private redisService: RedisService,
    private alertService: AlertService,
  ) {}

  async ingestTelemetry(data: TelemetryDto | TelemetryDto[]): Promise<void> {
    const readings = Array.isArray(data) ? data : [data];

    this.logger.log(`Ingesting ${readings.length} telemetry reading(s)`);

    for (const reading of readings) {
      try {
        // Save to MongoDB
        const telemetry = new this.telemetryModel({
          ...reading,
          ts: new Date(reading.ts),
        });
        await telemetry.save();

        // Update cache (latest reading per device)
        await this.redisService.setLatest(reading.deviceId, reading);

        // Check for alerts
        await this.alertService.checkAndSendAlert(
          reading.deviceId,
          reading.siteId,
          reading.ts,
          reading.metrics,
        );

        this.logger.debug(`Processed telemetry for device ${reading.deviceId}`);
      } catch (error) {
        this.logger.error(
          `Failed to process telemetry for device ${reading.deviceId}: ${error.message}`,
        );
        throw error;
      }
    }
  }

  async getLatest(deviceId: string): Promise<any> {
    // Try Redis first
    let latest = await this.redisService.getLatest(deviceId);

    if (latest) {
      this.logger.debug(`Cache hit for device ${deviceId}`);
      return latest;
    }

    // Fallback to MongoDB
    this.logger.debug(`Cache miss for device ${deviceId}, querying MongoDB`);
    const telemetry = await this.telemetryModel
      .findOne({ deviceId })
      .sort({ ts: -1 })
      .lean()
      .exec();

    if (telemetry) {
      // Reconstruct the response format
      latest = {
        deviceId: telemetry.deviceId,
        siteId: telemetry.siteId,
        ts: telemetry.ts.toISOString(),
        metrics: telemetry.metrics,
      };

      // Update cache
      await this.redisService.setLatest(deviceId, latest);
    }

    return latest;
  }

  async getSiteSummary(siteId: string, from: string, to: string): Promise<any> {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    this.logger.log(
      `Aggregating data for site ${siteId} from ${from} to ${to}`,
    );

    const result = await this.telemetryModel.aggregate([
      {
        $match: {
          siteId,
          ts: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgTemperature: { $avg: '$metrics.temperature' },
          maxTemperature: { $max: '$metrics.temperature' },
          avgHumidity: { $avg: '$metrics.humidity' },
          maxHumidity: { $max: '$metrics.humidity' },
          uniqueDevices: { $addToSet: '$deviceId' },
        },
      },
      {
        $project: {
          _id: 0,
          count: 1,
          avgTemperature: { $round: ['$avgTemperature', 2] },
          maxTemperature: 1,
          avgHumidity: { $round: ['$avgHumidity', 2] },
          maxHumidity: 1,
          uniqueDevices: { $size: '$uniqueDevices' },
        },
      },
    ]);

    return (
      result[0] || {
        count: 0,
        avgTemperature: 0,
        maxTemperature: 0,
        avgHumidity: 0,
        maxHumidity: 0,
        uniqueDevices: 0,
      }
    );
  }

  async checkHealth(): Promise<{ mongodb: boolean; redis: boolean }> {
    const mongodb = this.telemetryModel.db.readyState === 1;
    const redis = await this.redisService.ping();
    return { mongodb, redis };
  }
}
