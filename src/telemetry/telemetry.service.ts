import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telemetry, TelemetryDocument } from './schemas/telemetry.schema';
import { TelemetryDto } from './dto/telemetry.dto';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectModel(Telemetry.name)
    private telemetryModel: Model<TelemetryDocument>,
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

        this.logger.debug(`Processed telemetry for device ${reading.deviceId}`);
      } catch (error) {
        this.logger.error(
          `Failed to process telemetry for device ${reading.deviceId}: ${error.message}`,
        );
        throw error;
      }
    }
  }
}
